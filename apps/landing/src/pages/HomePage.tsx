import { FAQ } from '../components/FAQ';
import { FeatureGrid } from '../components/FeatureGrid';
import { FinalCTA } from '../components/FinalCTA';
import { FlowTabs } from '../components/FlowTabs';
import { Hero } from '../components/Hero';
import { Pricing } from '../components/Pricing';
import { ProofStats } from '../components/ProofStats';
import { SEOHead } from '../components/SEOHead';
import { UseCaseGrid } from '../components/UseCaseGrid';
import { useLanguage } from '../contexts/LanguageContext';

const HomePage = () => {
  const { language } = useLanguage();
  const getPath = (path: string) => `/${language}${path}`;

  return (
    <>
      <SEOHead
        title="Analytics Canvas"
        description="SQL, Python, and visualizations on one infinite canvas. Build data pipelines and collaborate with your team."
        path={getPath('/home')}
      />
      <div className="min-h-screen bg-[var(--page)] text-[var(--text)]">
        <Hero />
        <ProofStats />
        <FlowTabs />
        <FeatureGrid />
        <UseCaseGrid />
        <Pricing />
        <FAQ />
        <FinalCTA />
      </div>
    </>
  );
};

export default HomePage;
