# 🦖 Kaiju Dash

![React](https://img.shields.io/badge/react-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB)
![Vite](https://img.shields.io/badge/vite-%23646CFF.svg?style=for-the-badge&logo=vite&logoColor=white)
![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/tailwindcss-%2338B2AC.svg?style=for-the-badge&logo=tailwind-css&logoColor=white)

Um painel administrativo (dashboard) moderno, altamente performático e escalável, desenvolvido com as tecnologias mais recentes do ecossistema React. Focado na experiência do usuário e na facilidade de manutenção para desenvolvedores.

## ✨ Características Principais

- ⚡️ **Desenvolvimento Rápido:** Configurado com Vite para Hot Module Replacement (HMR) instantâneo.
- 🛡️ **Segurança e Estabilidade:** Totalmente tipado com TypeScript para prevenção de erros em tempo de compilação.
- 🎨 **Interface Elegante:** Utiliza Tailwind CSS e Shadcn UI para componentes acessíveis, responsivos e fáceis de customizar.
- 📡 **Gerenciamento de Dados:** Integração com TanStack Query (React Query) para cache, sincronização e atualização de estado assíncrono.
- 📊 **Visualização de Dados:** Gráficos interativos e dinâmicos com Recharts.
- ✅ **Validação de Formulários:** Fluxos seguros e robustos com React Hook Form e Zod.

## 🛠️ Tecnologias Utilizadas

| Categoria | Tecnologia |
| --- | --- |
| **Core** | React 18, Vite, TypeScript |
| **Estilização** | Tailwind CSS, Shadcn UI |
| **Gerenciamento de Estado** | TanStack Query |
| **Ícones e Gráficos** | Lucide React, Recharts |
| **Formulários** | React Hook Form, Zod |
| **Testes** | Vitest |

## 🚀 Como Iniciar

Siga os passos abaixo para executar o projeto no seu ambiente local.

### Pré-requisitos

Certifique-se de ter instalado em sua máquina:
- [Node.js](https://nodejs.org/) (versão 18 ou superior recomendada)
- NPM, Yarn ou pnpm (este projeto utiliza `npm` por padrão)

### Instalação

1. Clone o repositório ou faça o download dos arquivos.
2. Acesse a pasta do projeto:
```bash
cd kaiju-dash-main
```
3. Instale as dependências:
```bash
npm install
```

### Executando em Desenvolvimento

Inicie o servidor de desenvolvimento:
```bash
npm run dev
```

A aplicação estará disponível no seu navegador em `http://localhost:8080/`. As alterações no código serão refletidas instantaneamente.

## 📁 Arquitetura do Projeto

A estrutura de pastas foi organizada para facilitar a escalabilidade:

```text
kaiju-dash/
├── public/             # Ativos estáticos públicos (imagens, favicons)
├── src/                # Código-fonte da aplicação
│   ├── components/     # Componentes reutilizáveis (inclui Shadcn UI em ui/)
│   ├── hooks/          # Hooks customizados para lógica de negócio
│   ├── lib/            # Configurações globais e utilitários (utils, api)
│   ├── pages/          # Componentes que representam rotas/páginas completas
│   ├── App.tsx         # Componente raiz da aplicação
│   └── main.tsx        # Ponto de entrada do React
├── index.html          # Template HTML principal
├── tailwind.config.ts  # Configurações do Tailwind CSS
├── tsconfig.json       # Configurações globais do TypeScript
└── vite.config.ts      # Configurações do Vite
```

## 🧪 Testes

O projeto utiliza Vitest para testes. Para executar a suíte de testes unitários e de integração:

```bash
# Executar todos os testes
npm run test

# Executar testes em modo "watch" (observação contínua)
npm run test:watch
```

## 📦 Build para Produção

Para gerar a versão otimizada para produção:

```bash
npm run build
```

Os arquivos gerados estarão disponíveis na pasta `dist/`, prontos para serem servidos por qualquer servidor web estático (Nginx, Vercel, Netlify, etc.).

---
*Desenvolvido com ❤️ para a comunidade Kaiju.*
