import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/cadastro', '/login'],
        disallow: ['/dashboard', '/agenda', '/agendamento', '/clientes',
          '/servicos', '/profissionais', '/financeiro', '/comissoes',
          '/relatorios', '/notificacoes', '/configuracoes', '/admin',
          '/api/'],
      },
    ],
    sitemap: 'https://estaagendado.com.br/sitemap.xml',
  }
}
