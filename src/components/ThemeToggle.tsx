
import React from "react";
import { Button } from "@/components/ui/button";
import { Moon, Sun, BookOpenText } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";

export const ThemeToggle = () => {
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex items-center bg-secondary rounded-lg p-1 border">
      <Button
        variant="ghost"
        size="sm"
        className={`p-1 ${theme === 'light' ? 'bg-background' : ''}`}
        onClick={() => setTheme('light')}
        aria-label="Light Mode"
      >
        <Sun size={18} />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className={`p-1 ${theme === 'dark' ? 'bg-background' : ''}`}
        onClick={() => setTheme('dark')}
        aria-label="Dark Mode"
      >
        <Moon size={18} />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className={`p-1 ${theme === 'sepia' ? 'bg-background' : ''}`}
        onClick={() => setTheme('sepia')}
        aria-label="Sepia Mode"
      >
        <BookOpenText size={18} />
      </Button>
    </div>
  );
};
