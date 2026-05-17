# AgendaAI — Guia Completo de Instalação

## Pré-requisitos (já instalados)
- Node.js LTS
- VS Code
- Conta no GitHub, Supabase e Vercel

---

## Passo 1 — Configurar o banco de dados no Supabase

1. Acesse supabase.com e entre na sua conta
2. Clique em **"New project"**
3. Escolha um nome (ex: agendai), defina uma senha forte e clique em Create
4. Aguarde criar (1-2 minutos)
5. No menu lateral, clique em **SQL Editor**
6. Clique em **"New query"**
7. Abra o arquivo `supabase/schema.sql` desta pasta, copie todo o conteúdo e cole no editor
8. Clique em **"Run"** — você verá: "Banco de dados criado com sucesso! 🎉"

---

## Passo 2 — Pegar as chaves do Supabase

1. No menu lateral do Supabase, clique em **Settings > API**
2. Copie os valores:
   - **Project URL** → cole em `NEXT_PUBLIC_SUPABASE_URL` no arquivo `.env.local`
   - **anon public** → cole em `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** → cole em `SUPABASE_SERVICE_ROLE_KEY` (clique no olho para revelar)

---

## Passo 3 — Rodar o projeto localmente

Abra o VS Code, pressione **Ctrl+` (acento grave)** para abrir o terminal e execute:

```bash
# Entrar na pasta do projeto
cd agendai

# Instalar as dependências (só na primeira vez)
npm install

# Iniciar o servidor de desenvolvimento
npm run dev
```

Abra o navegador em: **http://localhost:3000**

---

## Passo 4 — Publicar na internet (Vercel)

1. Crie um repositório no GitHub com o nome "agendai"
2. No VS Code, abra o terminal e execute:
   ```bash
   git init
   git add .
   git commit -m "primeiro commit"
   git remote add origin https://github.com/SEU_USUARIO/agendai.git
   git push -u origin main
   ```
3. Acesse vercel.com, clique em **"New Project"**
4. Selecione o repositório "agendai" do GitHub
5. Na tela de configuração, clique em **"Environment Variables"** e adicione todas as variáveis do seu arquivo `.env.local`
6. Clique em **"Deploy"**
7. Em 2-3 minutos seu app estará no ar com um link como: `agendai.vercel.app`

---

## Passo 5 — Configurar o WhatsApp (Evolution API)

### Opção gratuita (para começar):

1. Acesse railway.app e crie uma conta
2. Clique em **"New Project > Deploy from GitHub repo"**
3. Use o repositório oficial: `https://github.com/EvolutionAPI/evolution-api`
4. Após deploy, acesse o painel da Evolution API e conecte seu WhatsApp via QR Code
5. Pegue a URL do seu serviço e a API Key e cole no `.env.local`:
   ```
   EVOLUTION_API_URL=https://sua-url.railway.app
   EVOLUTION_API_KEY=sua_chave_aqui
   ```

---

## Estrutura de arquivos

```
agendai/
├── src/
│   ├── app/
│   │   ├── login/          ← Tela de login
│   │   ├── dashboard/      ← Painel principal
│   │   ├── agenda/         ← Calendário
│   │   ├── agendamento/    ← Novo agendamento
│   │   ├── clientes/       ← Gestão de clientes
│   │   ├── servicos/       ← Gestão de serviços
│   │   ├── profissionais/  ← Gestão de profissionais
│   │   ├── financeiro/     ← Relatório financeiro
│   │   ├── whatsapp/       ← Automações WhatsApp
│   │   └── api/            ← APIs do servidor
│   ├── lib/                ← Conexão Supabase
│   └── types/              ← Tipos TypeScript
├── supabase/
│   └── schema.sql          ← Script do banco de dados
├── .env.local              ← Suas chaves (nunca suba no GitHub!)
└── README.md               ← Este arquivo
```

---

## Dúvidas frequentes

**O app abre mas não consigo fazer login?**
Verifique se as chaves do Supabase no `.env.local` estão corretas (sem espaços extras).

**As mensagens WhatsApp não chegam?**
Normal no início — sem a Evolution API configurada, as mensagens aparecem apenas no log do console. Configure o Passo 5 para ativar.

**Quero mudar o nome da empresa no app?**
Abra `src/app/dashboard/layout.tsx` e procure por "AgendaAI" para personalizar.

---

## Suporte
Qualquer dúvida, use o painel do ChatGPT ou Claude para tirar dúvidas técnicas específicas.
