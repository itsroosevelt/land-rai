"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider } from "next-themes"

// Importar el tipo directamente si es posible, o usar ComponentProps
import { type ComponentProps } from "react"

export function ThemeProvider({ 
  children, 
  ...props 
}: ComponentProps<typeof NextThemesProvider>) {
  // Suppress the React 19 script tag warning from next-themes
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    const orig = console.error;
    console.error = (...args: any[]) => {
      if (typeof args[0] === 'string' && args[0].includes('Encountered a script tag')) {
        return;
      }
      orig.apply(console, args);
    };
  }

  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}

