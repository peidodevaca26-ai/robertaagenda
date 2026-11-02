# Validação da entrega

Executada no ambiente de desenvolvimento com Node.js 24.19.0.

| Verificação | Resultado |
| --- | --- |
| `npm run build` | Passou, build de produção Next.js |
| TypeScript | Passou no build e em `npm run typecheck` |
| `npm test` | 12 testes passaram, nenhum pulado |
| `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e` | 3 testes passaram |
| Migração e segurança SQL | Aplicação em PostgreSQL PGlite; RLS entre dois usuários, bloqueio anônimo, conflito, criação/edição/cancelamento via RPC e exclusão passaram |
| API em modo privado, sem sessão | GET, POST, PUT e DELETE retornaram 401 usando configuração fictícia |
| Alteração com origem externa | Retornou 403 |
| Desktop 1440px e celular 390px | Inspeção visual realizada; sem erros JavaScript; sem rolagem horizontal no teste móvel |

A suíte de navegador exercitou criação, conflito, edição, cancelamento, reativação, exclusão, calendário, resumo cronológico, cópia ao clipboard, texto do link WhatsApp e descarte dos dados fictícios ao recarregar. Nenhuma mensagem foi enviada.

Os papéis e `auth.uid()` são simulados no teste PostgreSQL local. Não foi configurado um projeto Supabase remoto, enviado convite real ou validada persistência ponta a ponta com Supabase Auth. Esses passos e a hospedagem Vercel permanecem pendentes. O código está em demonstração por padrão; nenhum dado real foi utilizado e nenhuma publicação foi realizada.
