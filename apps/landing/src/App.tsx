import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { LanguageProvider } from './contexts/LanguageContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { BackToTop } from './components/BackToTop'
import { PageTransition } from './components/PageTransition'
import { Header } from './components/Header'
import { Footer } from './components/Footer'
import HomePage from './pages/HomePage'
import ProductPage from './pages/ProductPage'
import PricingPage from './pages/PricingPage'
import UseCasesPage from './pages/UseCasesPage'
import ComparePage from './pages/ComparePage'
import IntegrationsPage from './pages/IntegrationsPage'
import ResourcesPage from './pages/ResourcesPage'
import ChangelogPage from './pages/ChangelogPage'
import RoadmapPage from './pages/RoadmapPage'

const AppRoutes = () => {
  return (
    <div className="app-shell flex min-h-screen flex-col bg-white text-wy-text" style={{ margin: 0, padding: 0, width: '100%' }}>
      <Header />
      <main id="main-content" className="flex-1">
        <PageTransition>
          <Routes>
            {/* Redirect root to /en/home */}
            <Route path="/" element={<Navigate to="/en/home" replace />} />

            {/* English routes */}
            <Route path="/en/home" element={<HomePage />} />
            <Route path="/en/product/:section?" element={<ProductPage />} />
            <Route path="/en/pricing" element={<PricingPage />} />
            <Route path="/en/use-cases/:case?" element={<UseCasesPage />} />
            <Route path="/en/compare/:comparison?" element={<ComparePage />} />
            <Route path="/en/integrations/:integration?" element={<IntegrationsPage />} />
            <Route path="/en/resources/:resource?" element={<ResourcesPage />} />
            <Route path="/en/changelog" element={<ChangelogPage />} />
            <Route path="/en/roadmap" element={<RoadmapPage />} />

            {/* Russian routes */}
            <Route path="/ru/home" element={<HomePage />} />
            <Route path="/ru/product/:section?" element={<ProductPage />} />
            <Route path="/ru/pricing" element={<PricingPage />} />
            <Route path="/ru/use-cases/:case?" element={<UseCasesPage />} />
            <Route path="/ru/compare/:comparison?" element={<ComparePage />} />
            <Route path="/ru/integrations/:integration?" element={<IntegrationsPage />} />
            <Route path="/ru/resources/:resource?" element={<ResourcesPage />} />
            <Route path="/ru/changelog" element={<ChangelogPage />} />
            <Route path="/ru/roadmap" element={<RoadmapPage />} />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/en/home" replace />} />
          </Routes>
        </PageTransition>
      </main>
      <Footer />
      <BackToTop />
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <LanguageProvider>
          <AppRoutes />
        </LanguageProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}

export default App
