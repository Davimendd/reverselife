# Reverse Life

Site com um dado de 6 lados e um terminal onde toda rolagem feita por qualquer pessoa aparece em tempo real para todo mundo que estiver com o site aberto. Visual preto e vermelho, estilo terminal/glitch.

## Arquivos

- `index.html` — estrutura da página
- `style.css` — identidade visual (preto/vermelho, terminal, glitch no título)
- `app.js` — lógica do dado, animação e feed em tempo real
- `firebase-config.js` — onde você cola as credenciais do seu Firebase

## Como rodar

Basta abrir `index.html` num servidor local (por exemplo, com a extensão "Live Server" do VS Code, ou `python3 -m http.server` na pasta) e acessar pelo navegador. Não pode ser aberto direto com duplo-clique (`file://`) porque o site usa módulos JavaScript (`type="module"`), que exigem `http://`.

**Sem nenhuma configuração**, o site já funciona: as rolagens aparecem no terminal entre abas abertas no mesmo navegador (usando `localStorage`), então dá pra testar tudo sozinho antes de configurar o resto.

## Deixando o terminal compartilhado de verdade (entre qualquer pessoa, de qualquer lugar)

Para que a rolagem de uma pessoa apareça no terminal de todas as outras pessoas — e não só entre abas do seu navegador — é preciso um banco de dados em tempo real. O site já vem pronto para usar o **Firestore do Firebase** (gratuito no plano usado aqui).

Passo a passo:

1. Acesse [console.firebase.google.com](https://console.firebase.google.com) e crie um projeto novo (qualquer nome).
2. No menu lateral, vá em **Build > Firestore Database** e clique em **Criar banco de dados**.
3. Na aba **Regras** do Firestore, cole:

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /rolls/{roll} {
         allow read: if true;
         allow create: if true;
         allow update, delete: if false;
       }
     }
   }
   ```

4. Vá em **Configurações do projeto** (ícone de engrenagem) → role até **Seus apps** → clique no ícone `</>` para criar um app Web.
5. Copie o objeto `firebaseConfig` gerado e cole no arquivo `firebase-config.js`, substituindo os valores `"COLOQUE_AQUI"`.
6. Hospede os arquivos em qualquer lugar que sirva HTML estático (Firebase Hosting, Vercel, Netlify, GitHub Pages etc.) ou rode localmente com um servidor.

Assim que as credenciais forem preenchidas, o site detecta automaticamente e passa a usar o Firestore — o rodapé do site mostra "modo: online (Firebase)" quando isso acontece.

## Como funciona a rolagem

- Cada visitante recebe um "handle" aleatório por sessão (ex: `GHOST_4471`), sem precisar de login.
- Ao clicar no dado, no botão "ROLAR D6" ou apertar espaço, o dado gira e sorteia um valor de 1 a 6.
- O resultado é enviado ao banco (Firestore ou modo local) e aparece no terminal com horário, handle e valor, para todo mundo conectado.
- O terminal mostra as últimas 60 rolagens.
