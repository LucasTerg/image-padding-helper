
export const normalizeFileName = (name: string): string => {
  const polishReplacements: Record<string, string> = {
    'ą': 'a', 'Ą': 'A',
    'ć': 'c', 'Ć': 'C',
    'ę': 'e', 'Ę': 'E',
    'ł': 'l', 'Ł': 'L',
    'ń': 'n', 'Ń': 'N',
    'ó': 'o', 'Ó': 'O',
    'ś': 's', 'Ś': 'S',
    'ż': 'z', 'Ż': 'Z',
    'ź': 'z', 'Ź': 'Z'
  };
  
  let processed = name;
  for (const [from, to] of Object.entries(polishReplacements)) {
    processed = processed.replace(new RegExp(from, 'g'), to);
  }
  
  processed = processed.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  processed = processed.replace(/\s+/g, "-").toLowerCase();
  processed = processed.replace(/-+/g, "-");
  processed = processed.replace(/[^a-z0-9\-\.]/g, "");
  return processed;
};

export const generateFileName = (
  original: File, 
  index: number, 
  renameFiles: boolean, 
  baseFileName: string
): string => {
  if (renameFiles && baseFileName) {
    // Extract number from original filename if it exists
    const numericSuffix = original.name.match(/\d+/);
    
    if (numericSuffix) {
      return `${baseFileName}-${numericSuffix[0]}.jpg`;
    } else {
      return `${baseFileName}-${index + 1}.jpg`;
    }
  } else {
    // Still extract number from original filename if it exists
    const nameWithoutExt = original.name.substring(0, original.name.lastIndexOf('.'));
    const numericSuffix = nameWithoutExt.match(/(\d+)$/);
    
    if (numericSuffix) {
      // Ensure there's a dash before the number
      const basePart = nameWithoutExt.substring(0, nameWithoutExt.lastIndexOf(numericSuffix[0]));
      // Remove any existing dash at the end of basePart
      const cleanBasePart = basePart.endsWith('-') ? basePart : basePart;
      return `${cleanBasePart}-${numericSuffix[0]}.jpg`;
    } else {
      return `${nameWithoutExt}-${index + 1}.jpg`;
    }
  }
};
