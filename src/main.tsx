import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './responsive.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

/*
 * PWA: registra o service worker (app instalável e offline).
 * Só em produção, para não atrapalhar o hot reload do `npm run dev`.
 */
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`)
      .catch((error) => {
        console.warn('PhasorCAD: service worker não registrado.', error)
      })
  })
}

/*
 * Testes de console: carregados somente em desenvolvimento.
 *
 * Em produção, import.meta.env.DEV é false, o Vite remove
 * este bloco e os arquivos de src/test não entram no bundle.
 */
if (import.meta.env.DEV) {
  void Promise.all([
    import('./test/TestComplex'),
    import('./test/TestImpedances'),
    import('./test/TestSeries'),
    import('./test/TestCurrent'),
    import('./test/TestPhasor'),
    import('./test/TestPhasorReverse'),
    import('./test/TestPower'),
    import('./test/TestPowerDetails'),
    import('./test/TestACAnalyzer'),
    import('./test/TestCircuitBuilder'),
    import('./test/TestCircuitAnalyzer'),
    import('./test/TestConnections'),
    import('./test/TestCircuitModel'),
    import('./test/TestCircuitModelBuilder'),
    import('./test/TestCircuitObject'),
    import('./test/TestSourceVoltage'),
    import('./test/TestCircuitHelper'),
    import('./test/TestCircuitFrequency'),
    import('./test/TestCircuitGraph'),
    import('./test/TestMnaElectricalResults'),
    import('./test/TestMnaTopologies'),
    import('./test/TestPhasorDiagram'),
    import('./test/TestWaveform'),
    import('./test/TestCurrentSource'),
    import('./test/TestCircuitFile'),
    import('./test/TestPowerWave'),
    import('./test/TestFrequencySweep'),
    import('./test/TestCanvasZoom'),
    import('./test/TestCircuitAnimation'),
    import('./test/TestArbitraryTopologies'),
    import('./test/TestMultipleSources'),
    import('./test/TestReport'),
  ])
}
