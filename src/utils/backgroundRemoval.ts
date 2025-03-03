
import { pipeline, env } from '@huggingface/transformers';

// Konfiguracja transformers.js aby zawsze pobierał modele
env.allowLocalModels = false;
env.useBrowserCache = false;

const MAX_IMAGE_DIMENSION = 1024;

function resizeImageIfNeeded(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, image: HTMLImageElement) {
  let width = image.naturalWidth;
  let height = image.naturalHeight;

  if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
    if (width > height) {
      height = Math.round((height * MAX_IMAGE_DIMENSION) / width);
      width = MAX_IMAGE_DIMENSION;
    } else {
      width = Math.round((width * MAX_IMAGE_DIMENSION) / height);
      height = MAX_IMAGE_DIMENSION;
    }

    canvas.width = width;
    canvas.height = height;
    ctx.drawImage(image, 0, 0, width, height);
    return true;
  }

  canvas.width = width;
  canvas.height = height;
  ctx.drawImage(image, 0, 0);
  return false;
}

export const removeBackgroundWithAI = async (file: File): Promise<Blob> => {
  try {
    console.log('Rozpoczynanie procesu usuwania tła...');
    
    // Ładujemy obraz
    const imageElement = await loadImage(file);
    
    // Używamy modelu segmentacji do usunięcia tła
    const segmenter = await pipeline('image-segmentation', 'briaai/RMBG-2.0', {
      device: 'webgpu', // Użyj GPU jeśli dostępne
    });
    
    // Konwertuj HTMLImageElement na canvas
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) throw new Error('Nie udało się uzyskać kontekstu canvas');
    
    // Zmniejsz obraz jeśli potrzeba i narysuj go na canvas
    const wasResized = resizeImageIfNeeded(canvas, ctx, imageElement);
    console.log(`Obraz ${wasResized ? 'został' : 'nie został'} zmniejszony. Wymiary końcowe: ${canvas.width}x${canvas.height}`);
    
    // Pobierz dane obrazu jako base64
    const imageData = canvas.toDataURL('image/jpeg', 0.8);
    console.log('Obraz przekonwertowany na base64');
    
    // Przetwórz obraz za pomocą modelu segmentacji
    console.log('Przetwarzanie przy użyciu modelu segmentacji...');
    const result = await segmenter(imageData);
    
    console.log('Wynik segmentacji:', result);
    
    if (!result || !Array.isArray(result) || result.length === 0 || !result[0].mask) {
      throw new Error('Nieprawidłowy wynik segmentacji');
    }
    
    // Utwórz nowy canvas dla zamaskowanego obrazu
    const outputCanvas = document.createElement('canvas');
    outputCanvas.width = canvas.width;
    outputCanvas.height = canvas.height;
    const outputCtx = outputCanvas.getContext('2d');
    
    if (!outputCtx) throw new Error('Nie udało się uzyskać kontekstu wyjściowego canvas');
    
    // Narysuj oryginalny obraz
    outputCtx.drawImage(canvas, 0, 0);
    
    // Zastosuj maskę
    const outputImageData = outputCtx.getImageData(
      0, 0,
      outputCanvas.width,
      outputCanvas.height
    );
    const data = outputImageData.data;
    
    // Zastosuj odwróconą maskę do kanału alfa
    for (let i = 0; i < result[0].mask.data.length; i++) {
      // Odwróć wartość maski (1 - wartość), aby zachować obiekt zamiast tła
      const alpha = Math.round((1 - result[0].mask.data[i]) * 255);
      data[i * 4 + 3] = alpha;
    }
    
    outputCtx.putImageData(outputImageData, 0, 0);
    console.log('Maska zastosowana pomyślnie');
    
    // Konwertuj canvas na blob
    return new Promise((resolve, reject) => {
      outputCanvas.toBlob(
        (blob) => {
          if (blob) {
            console.log('Pomyślnie utworzono końcowy blob');
            resolve(blob);
          } else {
            reject(new Error('Nie udało się utworzyć bloba'));
          }
        },
        'image/png',
        1.0
      );
    });
  } catch (error) {
    console.error('Błąd podczas usuwania tła:', error);
    throw error;
  }
};

export const loadImage = (file: File): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
};
