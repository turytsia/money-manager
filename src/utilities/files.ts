const TOUCH_DEVICE_QUERY = '(pointer: coarse)';
const ABORT_ERROR_NAME = 'AbortError';
const OBJECT_URL_LIFETIME = 60_000;

/**
 * Hands a file to the user. On phones this opens the share sheet, which is
 * the reliable way to save a file from an installed web app on iOS.
 * Everywhere else it is a normal download.
 *
 * Returns false only when the user dismissed the share sheet.
 */
export async function saveTextFile(
  name: string,
  text: string,
  type: string,
): Promise<boolean> {
  const file = new File([text], name, { type });
  if (!canShareFile(file)) {
    downloadFile(file);
    return true;
  }
  try {
    await navigator.share({ files: [file] });
    return true;
  } catch (error) {
    if (error instanceof DOMException && error.name === ABORT_ERROR_NAME) {
      return false;
    }
    downloadFile(file);
    return true;
  }
}

function canShareFile(file: File): boolean {
  return (
    typeof navigator.canShare === 'function' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia(TOUCH_DEVICE_QUERY).matches &&
    navigator.canShare({ files: [file] })
  );
}

function downloadFile(file: File): void {
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.name;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), OBJECT_URL_LIFETIME);
}
