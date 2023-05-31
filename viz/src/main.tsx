import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import CardsApp from "./cards-ui/App.tsx";
import './index.css'

/**
 * super simple router - this is prototyping anyways
 * Uses query params so we can view it on GitHub pages
 */
function Router() {
  switch((new URL(window.location as any))?.searchParams?.get('page')) {
    case 'cards':
      return <CardsApp/>
    default:
      return <App />;
  }
}


ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <Router />
  </React.StrictMode>,
)
