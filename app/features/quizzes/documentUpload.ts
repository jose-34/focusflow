export const ACCEPTED_EXTENSIONS = '.pdf,.docx,.txt,.png,.jpg,.jpeg,.webp'
export const MAX_FILE_BYTES = 8 * 1024 * 1024

export const ACCEPTED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'image/png',
  'image/jpeg',
  'image/webp',
])

export function validateDocumentFile(file: File): string | null {
  if (!ACCEPTED_MIME_TYPES.has(file.type)) {
    return 'Unsupported file type — use PDF, DOCX, TXT, PNG, JPG, or WEBP'
  }
  if (file.size > MAX_FILE_BYTES) {
    return 'File is too large — please upload a document under 8MB'
  }
  return null
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      // FileReader's data URL is "data:<mime>;base64,<data>" — the API
      // wants just the base64 payload.
      resolve(result.slice(result.indexOf(',') + 1))
    }
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}
