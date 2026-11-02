# Agendarober

Painel de compromissos pessoais e profissionais. Next.js 16, TypeScript, Tailwind CSS 4 e Supabase PostgreSQL. Layout claro e responsivo, com menu lateral.

## Desenvolvimento

Node.js 24 (versão indicada em `.nvmrc`). Na pasta do projeto:

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Sem configuração, o painel usa **somente dados fictícios em memória**. Alterações desaparecem ao recarregar; não insira dados reais nesse modo. Não há cache offline nem armazenamento local. `DATA_MODE=supabase` ativa exclusivamente a API privada: erros de autenticação ou banco nunca caem silenciosamente no modo demonstrativo.

```sh
npm test
npm run typecheck
npm run build
npm start
```

## Funcionalidades

- Dashboard de hoje e próximos 30 dias, calendário mensal, lista de séries e filtro por categoria.
- Criar, editar, cancelar, reativar e excluir compromissos; categorias Atendimento, Pessoal, Academia, Igreja, Saúde, Família, Trabalho, Estudos, Lazer e Outros.
- Título, data, horário, duração, repetição, local/link e observação.
- Repetição semanal, quinzenal e mensal, sem data final. Em mês curto usa o último dia, retornando ao dia original nos meses seguintes.
- Edição, cancelamento e exclusão afetam **toda a série**, inclusive o início; não há exceções individuais.
- Conflitos consideram intervalos de duração e repetições futuras. Horários adjacentes são permitidos. Compromissos devem terminar até meia-noite do mesmo dia.
- Resumo cronológico da data selecionada, copiar e abrir WhatsApp. O envio é manual; observações não entram no resumo. Revise títulos e locais antes de compartilhar.
- O compartilhamento manual pelo link `wa.me` é gratuito e não exige conexão com a API do WhatsApp. Alertas automáticos não fazem parte do projeto: exigem WhatsApp Business Platform, número empresarial, modelos aprovados e podem gerar cobrança da Meta ou do provedor.
- Horários são locais, sem conversão de fuso. Use o navegador no fuso de sua mãe (por exemplo America/Sao_Paulo).

## Acesso privado sem tela de login no painel

**Proposta:** Supabase Auth por convite/link individual enviado por e-mail, com sessão em cookies HttpOnly, Secure em produção e SameSite=Lax. Sua mãe abre o convite para entrar. Ao expirar a sessão, o administrador envia outro link. Não há cadastro público, formulário de login ou senha compartilhada. O botão Sair revoga a sessão local. A API verifica `auth.getUser()` em cada operação; todas as operações dependem também de RLS por `auth.uid()`. A página pública contém apenas a estrutura, nunca dados reais.

O login acontece ao abrir o link, mesmo sem tela de login. Links são credenciais temporárias: não compartilhe, não coloque em logs ou documentos. Se esse fluxo não for aceitável, mantenha `DATA_MODE=demo` até escolher outra autenticação. Não use URL secreta, chave anônima sozinha ou remoção de RLS como proteção.

## Conectar Supabase (somente após aprovar e configurar o acesso)

1. Crie um projeto Supabase. Execute `supabase/migrations/202611020001_agenda.sql` no SQL Editor (ou via Supabase CLI). É uma migração inicial, execute uma única vez.
2. Em Authentication, desative novos cadastros públicos. Configure Site URL para o domínio HTTPS do painel e permita somente o callback exato `https://SEU-DOMINIO/auth/confirm` nos redirects. Não adicione curingas de produção.
3. Nos templates **Invite user** e **Magic Link**, use um link com token hash:
   ```html
   <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite"
     >Abrir minha agenda</a
   >
   ```
   Para o template Magic Link, troque `type=invite` por `type=magiclink`. Configure SMTP confiável e validade curta. Convide somente sua mãe por Authentication → Users → Invite user. Para renovar acesso de usuário existente, envie um magic link por uma operação administrativa confiável; não há endpoint público de envio neste projeto.
4. Configure no servidor `.env.local` (ou Vercel) `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY` com a URL e a chave publishable/anon do projeto. **Nunca use `service_role` ou uma chave secreta.** Nenhuma chave é incluída no bundle do navegador. A chave publishable não substitui autenticação.
5. Após revisar políticas e o convite, defina `DATA_MODE=supabase` e reinicie/reimplante. Sem sessão válida, consultas e alterações respondem 401. Não são carregados dados fictícios como substituto de uma falha.
6. Abra o convite individual no navegador da sua mãe. Crie um compromisso, recarregue e confira a persistência. Saia e confirme que a agenda não pode ser consultada. Teste com dois usuários: nenhum deve ler ou modificar os dados do outro, inclusive por chamada direta à API Supabase.

A tabela tem RLS habilitada e forçada, sem políticas para `anon`. Cada linha pertence ao usuário autenticado. As funções gravam sob os privilégios do chamador, sem `security definer`. O trigger verifica conflitos inclusive em chamadas diretas à tabela. A função de gravação serializa operações por usuário. Instale a migração antes de ativar o modo real.

## Vercel

1. Importe o repositório na Vercel, framework Next.js, Node.js 24. Build: `npm run build`; instalação: `npm ci`.
2. Para avaliar sem dados reais, mantenha `DATA_MODE=demo` e não configure Supabase.
3. Só configure variáveis privadas e `DATA_MODE=supabase` no ambiente Production depois de concluir o acesso acima. Não dê credenciais de produção a previews. Proteja previews pela Vercel ou use somente demonstração.
4. Configure domínio HTTPS e callbacks no Supabase. Faça redeploy após alterar variáveis.
5. Evite logs contendo URLs de convite, cookies ou respostas da agenda. Valide Auth, isolamento e persistência antes de colocar dados reais.

## Verificação e limites

`npm test` cobre validação, duração, conflitos, recorrências, cancelamentos, edição/exclusão, resumo, origem de requisições e a migração com RLS em PostgreSQL local via PGlite. O teste SQL em `supabase/tests/security.sql` testa RLS e conflito no PostgreSQL; execute apenas em um projeto de teste após a migração. Ele usa transação com rollback. O ambiente local sem Supabase não comprova Auth, RLS executada ou persistência remota.

Pendente para uso real: projeto Supabase e migração aplicada, SMTP/convites, variáveis privadas, validação com dois usuários, implantação Vercel e domínio. Não há integração de IA, financeiro, prontuários, Google Calendar, cadastro de pacientes, notificações ou envio automático.

### Testes de navegador

Após `npm run build`, execute `npx playwright install chromium` e `npm run test:e2e`. Para usar um Chromium já instalado: `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e`. A suíte inicia o servidor e valida CRUD, conflitos, calendário, resumo, clipboard, link WhatsApp, layout móvel e bloqueio do banco no modo demo. Execute sem variáveis de produção.
