// Runs the embedding model off the main thread so typing never stutters.
import { env, pipeline, type FeatureExtractionPipeline } from "@huggingface/transformers"

env.allowLocalModels = false

const MODEL = "Xenova/all-MiniLM-L6-v2" // 384 dimensions, ~23 MB quantized, cached by the browser after the first load
let extractor: Promise<FeatureExtractionPipeline> | null = null

function load() {
  extractor ??= pipeline("feature-extraction", MODEL, { dtype: "q8", device: "wasm" }) as Promise<FeatureExtractionPipeline>
  return extractor
}

self.onmessage = async (event: MessageEvent<{ id: number; texts?: string[] }>) => {
  const { id, texts } = event.data
  try {
    const model = await load()
    if (!texts?.length) return self.postMessage({ id, vectors: [] })
    const output = await model(texts, { pooling: "mean", normalize: true })
    self.postMessage({ id, vectors: output.tolist() as number[][] })
  } catch (error) {
    extractor = null
    self.postMessage({ id, error: String(error) })
  }
}
