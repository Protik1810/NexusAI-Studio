// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Window;
use std::process::{Command, Child};
use std::sync::Mutex;
use std::collections::HashMap;
use serde::{Deserialize, Serialize};
use reqwest::Client;
use std::path::{Path, PathBuf};
use std::fs::File;
use std::io::Write;
use futures_util::StreamExt;

#[derive(Default)]
struct AppState {
    processes: Mutex<HashMap<String, Child>>,
}

#[derive(Clone, Serialize)]
struct DownloadProgress {
    filename: String,
    downloaded: u64,
    total: Option<u64>,
}

#[derive(Deserialize)]
pub struct NativeGenParams {
    pub pipeline: String,
    pub model: String,
    pub clip_model: Option<String>,
    pub t5_model: Option<String>,
    pub vae_model: Option<String>,
    pub lora_model: Option<String>,
    pub lora_strength: Option<f32>,
    pub prompt: String,
    pub negative_prompt: Option<String>,
    pub width: u32,
    pub height: u32,
    pub steps: u32,
    pub cfg: f32,
    pub seed: i64,
    pub output_path: String,
}

#[tauri::command]
fn get_hardware_backend() -> String {
    // Detect GPU hardware (CUDA, Vulkan, Metal, CPU)
    if cfg!(target_os = "windows") {
        if Path::new("backend/win/cuda/sd-cli.exe").exists() || Path::new("backend/win/cuda/sd-cuda.exe").exists() {
            "cuda".into()
        } else if Path::new("backend/win/vulkan/sd-cli.exe").exists() || Path::new("backend/win/vulkan/sd-vulkan.exe").exists() {
            "vulkan".into()
        } else {
            "cpu".into()
        }
    } else if cfg!(target_os = "macos") {
        "metal".into()
    } else {
        "vulkan".into()
    }
}

#[tauri::command]
fn start_engine(
    state: tauri::State<'_, AppState>,
    name: String,
    executable_path: String,
    args: Vec<String>,
) -> Result<String, String> {
    let mut procs = state.processes.lock().map_err(|e| e.to_string())?;
    
    if procs.contains_key(&name) {
        return Ok(format!("{} is already running", name));
    }

    let child = Command::new(&executable_path)
        .args(&args)
        .spawn()
        .map_err(|e| format!("Failed to spawn {}: {}", executable_path, e))?;

    let id = child.id();
    procs.insert(name.clone(), child);

    Ok(format!("Started {} (PID: {})", name, id))
}

#[tauri::command]
fn stop_engine(state: tauri::State<'_, AppState>, name: String) -> Result<String, String> {
    let mut procs = state.processes.lock().map_err(|e| e.to_string())?;
    if let Some(mut child) = procs.remove(&name) {
        let _ = child.kill();
        let _ = child.wait();
        Ok(format!("Stopped {}", name))
    } else {
        Err(format!("Engine {} is not running", name))
    }
}

#[tauri::command]
async fn download_model(
    window: Window,
    url: String,
    dest_path: String,
    filename: String,
) -> Result<String, String> {
    let client = Client::new();
    let res = client.get(&url).send().await.map_err(|e| e.to_string())?;
    
    let total_size = res.content_length();
    let mut stream = res.bytes_stream();
    
    // Ensure parent directories exist
    if let Some(parent) = Path::new(&dest_path).parent() {
        let _ = std::fs::create_dir_all(parent);
    }

    let mut file = File::create(&dest_path).map_err(|e| e.to_string())?;
    let mut downloaded = 0;

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| e.to_string())?;
        file.write_all(&chunk).map_err(|e| e.to_string())?;
        downloaded += chunk.len() as u64;

        let _ = window.emit(
            "download_progress",
            DownloadProgress {
                filename: filename.clone(),
                downloaded,
                total: total_size,
            },
        );
    }

    Ok("Download complete".into())
}

#[tauri::command]
async fn generate_image_cmd(params: NativeGenParams) -> Result<String, String> {
    // 1. Locate the native binary (prioritize sd-cli.exe in cuda/vulkan)
    let candidates = [
        "backend/win/cuda/sd-cli.exe",
        "backend/win/vulkan/sd-cli.exe",
        "backend/win/cpu/sd-cli.exe",
        "backend/win/cuda/sd-cuda.exe",
        "backend/win/vulkan/sd-vulkan.exe",
        "backend/win/cpu/sd-cpu.exe",
        "sd-cli.exe",
        "sd.exe"
    ];

    let executable_rel = candidates.iter()
        .find(|c| Path::new(c).exists())
        .copied()
        .unwrap_or("backend/win/cuda/sd-cli.exe");

    let current_dir = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    
    // Resolve absolute model path
    let model_full = if Path::new(&params.model).is_absolute() {
        PathBuf::from(&params.model)
    } else {
        current_dir.join(&params.model)
    };

    // Resolve absolute output path
    let out_full = if Path::new(&params.output_path).is_absolute() {
        PathBuf::from(&params.output_path)
    } else {
        current_dir.join(&params.output_path)
    };

    let mut args: Vec<String> = Vec::new();
    
    if params.pipeline == "flux" {
        args.push("--diffusion-model".into());
        args.push(model_full.to_string_lossy().to_string());
        args.push("--vae-tiling".into());

        if let Some(clip) = params.clip_model {
            let mut clip_full = if Path::new(&clip).is_absolute() { PathBuf::from(&clip) } else { current_dir.join(&clip) };
            let clip_lower = clip.to_lowercase();
            let model_lower = params.model.to_lowercase();

            if clip_lower.contains("qwen_3_8b_fp8mixed") {
                let gguf_path = current_dir.join("models/clip/flux2-klein-9b-uncensored-text-encoder-q8_0.gguf");
                let ponpoke_path = current_dir.join("models/clip/ponpokeflux2-klein-9b-uncensored-text-encoder.safetensors");
                if gguf_path.exists() {
                    clip_full = gguf_path;
                } else if ponpoke_path.exists() {
                    clip_full = ponpoke_path;
                }
            }

            let final_clip_lower = clip_full.to_string_lossy().to_lowercase();
            if final_clip_lower.contains("qwen") || final_clip_lower.contains("klein") || final_clip_lower.contains("llm") || final_clip_lower.ends_with(".gguf") || model_lower.contains("flux-2") || model_lower.contains("flux2") || model_lower.contains("klein") {
                args.push("--llm".into());
            } else {
                args.push("--clip_l".into());
            }
            args.push(clip_full.to_string_lossy().to_string());
        }
        if let Some(t5) = params.t5_model {
            let t5_full = if Path::new(&t5).is_absolute() { PathBuf::from(&t5) } else { current_dir.join(&t5) };
            if t5_full.exists() {
                args.push("--t5xxl".into());
                args.push(t5_full.to_string_lossy().to_string());
            }
        }
        if let Some(vae) = params.vae_model {
            let mut vae_full = if Path::new(&vae).is_absolute() { PathBuf::from(&vae) } else { current_dir.join(&vae) };
            let is_flux2 = params.model.to_lowercase().contains("flux-2") || params.model.to_lowercase().contains("flux2") || params.model.to_lowercase().contains("klein");
            if is_flux2 && vae.to_lowercase().contains("ae.safetensors") {
                let flux2_vae = current_dir.join("models/vae/flux2-vae.safetensors");
                if flux2_vae.exists() {
                    vae_full = flux2_vae;
                }
            }
            if vae_full.exists() {
                args.push("--vae".into());
                args.push(vae_full.to_string_lossy().to_string());
            }
        }
    } else {
        args.push("-m".into());
        args.push(model_full.to_string_lossy().to_string());
        if let Some(neg) = params.negative_prompt {
            if !neg.trim().is_empty() {
                args.push("-n".into());
                args.push(neg);
            }
        }
    }

    if let Some(lora) = params.lora_model {
        if !lora.trim().is_empty() {
            let lora_dir = current_dir.join("models/loras");
            args.push("--lora-model-dir".into());
            args.push(lora_dir.to_string_lossy().to_string());
        }
    }

    args.push("-o".into());
    args.push(out_full.to_string_lossy().to_string());

    args.push("-W".into());
    args.push(params.width.to_string());

    args.push("-H".into());
    args.push(params.height.to_string());

    args.push("--steps".into());
    args.push(params.steps.to_string());

    args.push("--cfg-scale".into());
    args.push(params.cfg.to_string());

    if params.seed >= 0 {
        args.push("--seed".into());
        args.push(params.seed.to_string());
    }

    let exec_full = current_dir.join(executable_rel);
    let working_dir = exec_full.parent().unwrap_or(&current_dir).to_path_buf();
    let out_str = out_full.to_string_lossy().to_string();

    let output = tokio::task::spawn_blocking(move || {
        Command::new(&exec_full)
            .current_dir(&working_dir)
            .args(&args)
            .output()
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| format!("Failed to spawn stable-diffusion.cpp binary at {:?}: {}", exec_full, e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stdout = String::from_utf8_lossy(&output.stdout);
        return Err(format!("stable-diffusion.cpp GPU Error:\n{}\n{}", stderr, stdout));
    }

    Ok(out_str)
}

fn main() {
    tauri::Builder::default()
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            get_hardware_backend,
            start_engine,
            stop_engine,
            download_model,
            generate_image_cmd
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
