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
    
    console.log('Ładowanie modelu segmentacji...');
    // Używamy modelu segmentacji, który jest poprawnie obsługiwany
    const segmenter = await pipeline('image-segmentation', 'Xenova/segformer-b0-finetuned-ade-512-512', {
      progress_callback: (progressInfo: any) => {
        console.log(`Postęp ładowania modelu: ${Math.round(progressInfo.progress * 100)}%`);
      },
      revision: 'main',
      cache_dir: '/', // Katalog cache w przeglądarce
      device: 'webgpu', // Użyj GPU jeśli dostępne, fallback do 'cpu'
    });
    
    console.log('Model segmentacji załadowany');
    
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
    
    // Znajdź granice obiektu, aby go wykadrować (usunąć białe tło)
    const imageWithAlpha = outputCtx.getImageData(0, 0, outputCanvas.width, outputCanvas.height);
    const dataWithAlpha = imageWithAlpha.data;
    
    let minX = outputCanvas.width;
    let minY = outputCanvas.height;
    let maxX = 0;
    let maxY = 0;
    
    // Szukamy granic obiektu (piksele z nieprzezroczystością > 0)
    for (let y = 0; y < outputCanvas.height; y++) {
      for (let x = 0; x < outputCanvas.width; x++) {
        const idx = (y * outputCanvas.width + x) * 4;
        if (dataWithAlpha[idx + 3] > 10) { // Jeśli piksel ma jakąkolwiek nieprzezroczystość
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
    }
    
    // Dodaj margines wokół wykrytego obiektu
    const padding = 10;
    minX = Math.max(0, minX - padding);
    minY = Math.max(0, minY - padding);
    maxX = Math.min(outputCanvas.width, maxX + padding);
    maxY = Math.min(outputCanvas.height, maxY + padding);
    
    // Sprawdź, czy znaleziono granice obiektu
    if (maxX - minX <= 0 || maxY - minY <= 0) {
      console.log('Nie znaleziono obiektu do wykadrowania, używam całego obrazu');
      minX = 0;
      minY = 0;
      maxX = outputCanvas.width;
      maxY = outputCanvas.height;
    }
    
    // Utwórz nowy canvas tylko dla wykadrowanego obiektu
    const croppedCanvas = document.createElement('canvas');
    const cropWidth = maxX - minX;
    const cropHeight = maxY - minY;
    croppedCanvas.width = cropWidth;
    croppedCanvas.height = cropHeight;
    const croppedCtx = croppedCanvas.getContext('2d');
    
    if (!croppedCtx) throw new Error('Nie udało się uzyskać kontekstu przyciętego canvas');
    
    // Narysuj tylko wykadrowany obszar na nowym canvas
    croppedCtx.drawImage(
      outputCanvas,
      minX, minY, cropWidth, cropHeight,
      0, 0, cropWidth, cropHeight
    );
    
    console.log(`Obraz wykadrowany do: ${cropWidth}x${cropHeight}px`);
    
    // Konwertuj canvas na blob
    return new Promise((resolve, reject) => {
      croppedCanvas.toBlob(
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
