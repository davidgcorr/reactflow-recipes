import * as React from 'react';
import { createRoot } from 'react-dom/client';
import katex from 'katex';
import { Button } from './components/ui/button';
import { Slider } from './components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './components/ui/select';
export { React, createRoot, Button, Slider, Select, SelectContent, SelectItem, SelectTrigger, SelectValue };
export function latex(element: HTMLElement, expression: string) {
  element.innerHTML = katex.renderToString(expression, { throwOnError: false, output: 'mathml', displayMode: true, trust: false });
}
