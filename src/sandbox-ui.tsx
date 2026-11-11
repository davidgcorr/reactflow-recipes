import * as React from 'react';
import { createRoot } from 'react-dom/client';
import katex from 'katex';
import { Button } from './components/ui/button';
import { Slider } from './components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './components/ui/select';
export { React, createRoot, Button, Slider, Select, SelectContent, SelectItem, SelectTrigger, SelectValue };
const formulaObservers = new WeakMap<HTMLElement, ResizeObserver>();
export function latex(element: HTMLElement, expression: string) {
  formulaObservers.get(element)?.disconnect();
  const viewport = document.createElement('div'), formula = document.createElement('div');
  viewport.className = 'math-viewport'; formula.className = 'math-content';
  formula.innerHTML = katex.renderToString(expression, { throwOnError: false, output: 'mathml', displayMode: true, trust: false });
  viewport.append(formula); element.replaceChildren(viewport);
  const fit = () => {
    const scale = Math.min(1, Math.max(1, viewport.clientWidth - 8) / Math.max(1, formula.scrollWidth), Math.max(1, viewport.clientHeight - 8) / Math.max(1, formula.scrollHeight));
    formula.style.transform = `translate(-50%, -50%) scale(${scale})`;
  };
  const observer = new ResizeObserver(fit);
  observer.observe(viewport); observer.observe(formula); formulaObservers.set(element, observer); fit();
  return () => { observer.disconnect(); formulaObservers.delete(element); };
}
