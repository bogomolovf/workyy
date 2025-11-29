import { useState } from 'react'
import React from 'react'
import { useLanguage } from '../contexts/LanguageContext'
import { SEOHead } from '../components/SEOHead'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'

const PricingPage = () => {
  const { language, content } = useLanguage()
  const pricingContent = content.pricing

  const getPath = (path: string) => {
    return `/${language}${path}`
  }

  const [teamSize, setTeamSize] = useState(8)
  const [boardCount, setBoardCount] = useState(12)
  const [aiMinutes, setAiMinutes] = useState(30)

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    message: '',
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    console.log('Demo Request Submitted:', formData)
    alert(language === 'en' ? 'Your demo request has been sent!' : 'Ваш запрос на демо отправлен!')
    setFormData({ name: '', email: '', company: '', message: '' })
  }

  const calculatorPlan = teamSize <= 5 ? pricingContent.plans[0] : teamSize <= 20 ? pricingContent.plans[1] : pricingContent.plans[2]
  const addOnCost = Math.max(0, teamSize - 10) * 5 + Math.max(0, boardCount - 10) * 2 + aiMinutes * 0.4
  const basePrice = calculatorPlan.name === 'Free' ? 0 : calculatorPlan.name === 'Pro' ? 49 : 149
  const estimatedCost = calculatorPlan.name === 'Free' ? 0 : basePrice + addOnCost

  return (
    <div className="bg-[var(--color-bg-root)] text-[var(--color-text-primary)] min-h-screen transition-theme">
      <SEOHead
        title={pricingContent.title}
        description={pricingContent.description}
        path={getPath('/pricing')}
      />
      <main id="main-content" className="relative overflow-hidden section-spacing">
        <div className="absolute inset-0 bg-[var(--gradient-hero)] pointer-events-none" />
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h1 className="typography-section mb-4">{pricingContent.title}</h1>
            <p className="typography-base text-[var(--color-text-secondary)] max-w-2xl mx-auto">{pricingContent.description}</p>
          </div>

          <Card variant="elevated" className="mb-16 grid lg:grid-cols-2 gap-6">
            <div>
              <h3 className="typography-subsection mb-2">{language === 'en' ? 'Interactive pricing calculator' : 'Интерактивный калькулятор'}</h3>
              <p className="typography-small mb-6">
                {language === 'en'
                  ? 'Slide to match your team size, number of canvases, and AI usage to see the plan that fits best.'
                  : 'Подберите план, двигая слайдеры команды, канв и использования AI.'}
              </p>
              <div className="space-y-5">
                <label className="block text-sm text-[var(--color-text-primary)]">
                  <span className="flex items-center justify-between mb-1">
                    {language === 'en' ? 'Team members' : 'Участников команды'}
                    <strong>{teamSize}</strong>
                  </span>
                  <input
                    type="range"
                    min={1}
                    max={40}
                    value={teamSize}
                    onChange={(e) => setTeamSize(Number(e.target.value))}
                    className="w-full accent-[var(--color-accent-primary)]"
                  />
                </label>
                <label className="block text-sm text-[var(--color-text-primary)]">
                  <span className="flex items-center justify-between mb-1">
                    {language === 'en' ? 'Active canvases' : 'Активных канв'}
                    <strong>{boardCount}</strong>
                  </span>
                  <input
                    type="range"
                    min={5}
                    max={40}
                    value={boardCount}
                    onChange={(e) => setBoardCount(Number(e.target.value))}
                    className="w-full accent-[var(--color-accent-secondary)]"
                  />
                </label>
                <label className="block text-sm text-[var(--color-text-primary)]">
                  <span className="flex items-center justify-between mb-1">
                    {language === 'en' ? 'AI minutes / month' : 'Минуты AI в месяц'}
                    <strong>{aiMinutes}</strong>
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={120}
                    value={aiMinutes}
                    onChange={(e) => setAiMinutes(Number(e.target.value))}
                    className="w-full accent-[var(--color-accent-warm)]"
                  />
                </label>
              </div>
            </div>
            <Card variant="default" className="flex flex-col justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-[var(--color-accent-primary)] mb-2">
                  {language === 'en' ? 'Suggested plan' : 'Рекомендованный план'}
                </p>
                <h4 className="text-3xl font-bold mb-2">{calculatorPlan.name}</h4>
                <p className="typography-small mb-6">{calculatorPlan.price}</p>
                <div className="flex items-end gap-2">
                  <span className="text-4xl font-bold text-[var(--color-accent-primary)]">
                    {calculatorPlan.price === 'Free forever' ? '$0' : `$${estimatedCost.toFixed(0)}`}
                  </span>
                  {calculatorPlan.price !== 'Free forever' && (
                    <span className="typography-small mb-1">{language === 'en' ? 'per month (est.)' : 'в месяц (оценка)'}</span>
                  )}
                </div>
              </div>
              <ul className="typography-small space-y-1 mt-6 text-[var(--color-text-secondary)]">
                <li>• {teamSize} {language === 'en' ? 'teammates' : 'участников'}</li>
                <li>• {boardCount} {language === 'en' ? 'canvases' : 'канв'}</li>
                <li>• {aiMinutes} {language === 'en' ? 'AI min' : 'минут AI'}</li>
              </ul>
            </Card>
          </Card>

          <div className="grid md:grid-cols-3 gap-8 mb-20">
            {pricingContent.plans.map((plan, index) => (
              <Card
                key={index}
                variant={plan.highlight ? 'bordered' : 'default'}
                className={`flex flex-col hover:scale-[1.02] transition-smooth ${
                  plan.highlight ? 'shadow-theme-lg' : ''
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <h2 className="typography-subsection">{plan.name}</h2>
                  {plan.highlight && <Badge variant="primary">Best for teams</Badge>}
                  {plan.name === 'Free' && <Badge variant="secondary">Starter</Badge>}
                </div>
                <p className="text-5xl font-bold text-[var(--color-accent-primary)] mb-2">{plan.price}</p>
                <ul className="space-y-3 typography-base text-[var(--color-text-secondary)] flex-grow mb-8">
                  {plan.features.map((feature, fIdx) => (
                    <li key={fIdx} className="flex items-center">
                      <svg
                        className="w-5 h-5 text-[var(--color-accent-primary)] mr-2 flex-shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {feature}
                    </li>
                  ))}
                </ul>
                <Button
                  variant={plan.highlight ? 'primary' : 'secondary'}
                  size="md"
                  href={plan.cta === 'Contact Sales' ? '#contact-form' : '#'}
                  onClick={plan.cta === 'Contact Sales' ? undefined : (e?: React.MouseEvent<HTMLAnchorElement>) => {
                    e?.preventDefault()
                    document.getElementById('contact-form')?.scrollIntoView({ behavior: 'smooth' })
                  }}
                  className="w-full"
                >
                  {plan.cta}
                </Button>
              </Card>
            ))}
          </div>

          <Card id="contact-form" variant="elevated" className="max-w-3xl mx-auto">
            <h2 className="typography-section text-center mb-6">
              {language === 'en' ? 'Contact us for a Demo' : 'Связаться для демо'}
            </h2>
            <p className="typography-base text-[var(--color-text-secondary)] text-center mb-8">
              {language === 'en'
                ? 'Interested in an Enterprise plan or a personalized walkthrough? Fill out the form below, and we\'ll get in touch.'
                : 'Заинтересованы в Enterprise-плане или персональной демонстрации? Заполните форму ниже, и мы свяжемся с вами.'}
            </p>
            <form onSubmit={handleSubmit} className="grid gap-6 md:grid-cols-2">
              <div className="flex flex-col">
                <label htmlFor="name" className="block typography-small font-medium mb-2">
                  {language === 'en' ? 'Your Name' : 'Ваше имя'}
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 rounded-md bg-[var(--color-bg-surface)] border border-[var(--color-border)] focus:ring-[var(--color-accent-primary)] focus:border-[var(--color-accent-primary)] outline-none text-[var(--color-text-primary)] transition-smooth"
                />
              </div>
              <div className="flex flex-col">
                <label htmlFor="email" className="block typography-small font-medium mb-2">
                  {language === 'en' ? 'Work Email' : 'Рабочий email'}
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 rounded-md bg-[var(--color-bg-surface)] border border-[var(--color-border)] focus:ring-[var(--color-accent-primary)] focus:border-[var(--color-accent-primary)] outline-none text-[var(--color-text-primary)] transition-smooth"
                />
              </div>
              <div className="flex flex-col">
                <label htmlFor="company" className="block typography-small font-medium mb-2">
                  {language === 'en' ? 'Company Name' : 'Название компании'}
                </label>
                <input
                  type="text"
                  id="company"
                  name="company"
                  value={formData.company}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 rounded-md bg-[var(--color-bg-surface)] border border-[var(--color-border)] focus:ring-[var(--color-accent-primary)] focus:border-[var(--color-accent-primary)] outline-none text-[var(--color-text-primary)] transition-smooth"
                />
              </div>
              <div className="md:col-span-2 flex flex-col">
                <label htmlFor="message" className="block typography-small font-medium mb-2">
                  {language === 'en' ? 'Your Message (Optional)' : 'Ваше сообщение (необязательно)'}
                </label>
                <textarea
                  id="message"
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  rows={4}
                  className="w-full px-4 py-2 rounded-md bg-[var(--color-bg-surface)] border border-[var(--color-border)] focus:ring-[var(--color-accent-primary)] focus:border-[var(--color-accent-primary)] outline-none text-[var(--color-text-primary)] transition-smooth"
                ></textarea>
              </div>
              <div className="md:col-span-2 flex justify-end">
                <Button type="submit" variant="primary" size="md" className="w-full md:w-auto px-10">
                  {language === 'en' ? 'Request a Demo' : 'Запросить демо'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      </main>

    </div>
  )
}

export default PricingPage

