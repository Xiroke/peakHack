import { PageContainer } from '../components/PageContainer'
import { AppLink } from '../lib/router'

type PlaceholderPageProps = {
  eyebrow: string
  title: string
  description: string
}

export function PlaceholderPage({ eyebrow, title, description }: PlaceholderPageProps) {
  return (
    <PageContainer>
      <section className="placeholder-page" aria-labelledby="placeholder-title">
        <p className="eyebrow">{eyebrow}</p>
        <h1 id="placeholder-title">{title}</h1>
        <p>{description}</p>
        <AppLink className="text-link" to="/">
          Вернуться на главную
        </AppLink>
      </section>
    </PageContainer>
  )
}
