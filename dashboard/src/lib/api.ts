import type { DiagnosticResult, UploadResponse } from './types'

export const DIAGNOSTICS_API_BASE =
  process.env.NEXT_PUBLIC_TRIBE_API_BASE_URL ?? 'http://localhost:8000/api/v1/diagnostics'

const API_KEY = process.env.NEXT_PUBLIC_API_KEY ?? ''

export function apiHeaders(extra?: Record<string, string>): Record<string, string> {
  return API_KEY ? { 'X-API-Key': API_KEY, ...extra } : { ...extra }
}

export async function extractErrorMessage(response: Response): Promise<string> {
  try {
    const data = await response.json()
    if (typeof data?.detail === 'string') return data.detail
    if (typeof data?.message === 'string') return data.message
  } catch {
    return `Request failed with status ${response.status}.`
  }
  return `Request failed with status ${response.status}.`
}

export function uploadVideoWithProgress(
  file: File,
  onProgress: (progress: number) => void,
): Promise<UploadResponse> {
  return new Promise<UploadResponse>((resolve, reject) => {
    const payload = new FormData()
    payload.append('file', file)

    const request = new XMLHttpRequest()
    request.open('POST', `${DIAGNOSTICS_API_BASE}/upload`)
    request.responseType = 'json'
    if (API_KEY) request.setRequestHeader('X-API-Key', API_KEY)

    request.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        onProgress(Math.min(99, Math.round((event.loaded / event.total) * 100)))
        return
      }
      onProgress(40)
    }

    request.onload = () => {
      const responseBody = request.response ?? {}
      if (request.status >= 200 && request.status < 300) {
        onProgress(100)
        resolve(responseBody as UploadResponse)
        return
      }
      const message =
        typeof responseBody?.detail === 'string'
          ? responseBody.detail
          : typeof responseBody?.message === 'string'
            ? responseBody.message
            : `Upload failed with status ${request.status}.`
      reject(new Error(message))
    }

    request.onerror = () => reject(new Error('Upload failed.'))
    request.onabort = () => reject(new Error('Upload was cancelled.'))

    onProgress(2)
    request.send(payload)
  })
}

export async function analyzeUrlPreview(
  url: string,
  analysisDepth: string,
  formatType: string,
): Promise<DiagnosticResult> {
  const response = await fetch(`${DIAGNOSTICS_API_BASE}/url-preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...apiHeaders() },
    body: JSON.stringify({ url, analysis_depth: analysisDepth, format_type: formatType }),
  })
  if (!response.ok) {
    const msg = await extractErrorMessage(response)
    throw new Error(msg)
  }
  return response.json() as Promise<DiagnosticResult>
}
