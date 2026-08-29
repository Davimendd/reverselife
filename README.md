# Reverse Life

Site com um dado de 6 lados e um terminal onde toda rolagem feita por qualquer pessoa aparece em tempo real para todo mundo que estiver com o site aberto. Visual preto e vermelho, estilo terminal/glitch.

## Arquivos

- `index.html` — estrutura da página (abas, modais, terminal, campanhas)
- `style.css` — identidade visual (preto/vermelho, terminal, glitch no título)
- `firebase-config.js` — onde você cola as credenciais do seu Firebase
- `firebase-core.js` — inicialização compartilhada do Firebase (Firestore + Storage)
- `identity.js` — login, criar conta e sessão (Firebase Authentication)
- `sound.js` — efeitos sonoros sintetizados (sem arquivos de áudio)
- `app.js` — lógica do dado, animação e feed em tempo real
- `campaigns.js` — lógica de campanhas, personagens, dano, ferimentos e kits médicos

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
         allow create: if request.auth != null;
         allow update, delete: if false;
       }
       match /usernames/{username} {
         allow read: if true;
         allow create: if request.auth != null
                       && !exists(/databases/$(database)/documents/usernames/$(username));
         allow update, delete: if false;
       }
       match /users/{uid} {
         allow read: if request.auth != null && request.auth.uid == uid;
         allow create: if request.auth != null && request.auth.uid == uid;
         allow update, delete: if false;
       }
     }
   }
   ```

   A coleção `usernames` é o que garante que duas contas não consigam escolher o mesmo handle: cada nome vira o ID de um documento, e só é possível criar o documento se ele ainda não existir. A coleção `users` guarda, para cada conta logada (`uid`), qual é o seu handle.

4. Vá em **Build > Authentication** → **Sign-in method** → ative o provedor **E-mail/senha**. Sem isso, ninguém consegue criar conta ou entrar no site.
5. Vá em **Configurações do projeto** (ícone de engrenagem) → role até **Seus apps** → clique no ícone `</>` para criar um app Web.
6. Copie o objeto `firebaseConfig` gerado e cole no arquivo `firebase-config.js`, substituindo os valores `"COLOQUE_AQUI"`.
7. Hospede os arquivos em qualquer lugar que sirva HTML estático (Firebase Hosting, Vercel, Netlify, GitHub Pages etc.) ou rode localmente com um servidor.

Assim que as credenciais forem preenchidas, o site detecta automaticamente e passa a usar o Firestore — o rodapé do site mostra "modo: online (Firebase)" quando isso acontece.

## Login e contas

O site agora exige uma conta de verdade (e-mail + senha via **Firebase Authentication**) para rolar o dado ou mexer em campanhas:

- **Criar conta**: e-mail, senha (mínimo 6 caracteres) e um handle único (3–16 caracteres: letras, números e underscore). O handle continua sendo o nome exibido no terminal e nas fichas.
- **Entrar**: e-mail e senha. A sessão fica salva pelo próprio Firebase — ao recarregar a página ou voltar depois, a pessoa continua logada automaticamente.
- **Esqueci minha senha**: envia um e-mail de recuperação (só funciona com Firebase configurado).
- **Sair**: botão "sair" no topo, ao lado do handle.

Com login de verdade, as permissões de campanha (só o narrador altera dano/kits, etc.) agora são baseadas na conta autenticada (`uid`), não mais só num nome escolhido livremente no navegador — o que torna as regras do Firestore abaixo capazes de aplicar essas permissões de verdade no servidor, e não só esconder botões na interface.

⚠️ **Modo local (sem Firebase configurado):** o site continua funcionando para testes, com um sistema de contas simplificado guardado no `localStorage` — mas as senhas ficam salvas em texto simples no navegador, sem nenhuma segurança real. Use o modo local só para experimentar o site antes de configurar o Firebase; nunca reutilize uma senha de verdade nele.

## Sons

Todos os efeitos são gerados na hora pelo navegador (Web Audio API) — não há nenhum arquivo de áudio no projeto:

- Um "clique" seco toca a cada instante da animação do dado rolando.
- Quando o resultado é o pior possível de cada tabela (🔴 — Morte Instantânea, Ataque Devastador ou Dano no bloco simplificado), toca um alarme de terminal (dois bipes graves + um agudo).
- O ícone de alto-falante no topo da página liga/desliga o som; a preferência fica salva no navegador.
- Por política dos navegadores, o som só é liberado depois do primeiro clique na página (isso já acontece naturalmente ao rolar o dado).

## Sistemas de dado (tabelas de resultado)

Acima do dado há um seletor com três sistemas — a escolha fica salva no navegador e é enviada junto com cada rolagem, então o terminal mostra qual sistema estava ativo para quem rolou:

- **🎲 Tabela do Dado** — resultado individual para cada face (1 a 6), de Morte Instantânea a Fuga Perfeita.
- **⚙️ Variação Simplificada** — dois blocos: 1–3 é Dano, 4–6 é Escapou.
- **🎯 Dado de Execução** — usado quando o personagem é alcançado e há chance de execução, de Ataque Devastador a Escape Perfeito.

Depois de cada rolagem, a descrição completa do resultado aparece abaixo do dado, e um resumo (ex: "🟢 Dano Padrão") é anexado à linha correspondente no terminal.

## Campanhas de RPG

Uma segunda aba, "📖 Campanhas", funciona como salas: qualquer pessoa pode criar uma campanha (nome, descrição, imagem) e qualquer pessoa que acessar o site pode entrar nela e criar uma ficha de personagem (nome completo, gênero, ponto forte, ponto fraco, foto). Todos os personagens da campanha aparecem para todo mundo.

**Barra de dano (0–100%)**, com faixas de status:
- 0–24%: estável
- 25–49%: ferido
- 50–74%: muito ferido
- 75–99%: estado crítico
- 100%: morte

Só quem criou a campanha pode aumentar ou diminuir a barra de dano de qualquer personagem dela.

**Ferimentos e limitações**: um campo de texto livre na ficha, editável por quem criou a campanha OU por quem criou aquela ficha específica.

**Editar ficha**: quem criou uma ficha pode editá-la depois de pronta — nome completo, gênero, ponto forte, ponto fraco e foto — através do botão "✎ editar" que aparece no topo do card. Ao trocar a foto, a antiga é substituída; deixando o campo de foto em branco, a foto atual é mantida. Dano, ferimentos e kits médicos continuam com suas próprias regras de permissão, separadas dessa edição.

**Histórico de eventos**: cada campanha tem um mini-log próprio, separado do terminal de dados, registrando o que acontece com as fichas ao longo do tempo — mudanças de dano (quem aplicou, quanto e o novo total), uso/adição/remoção de kits médicos, edições de ferimentos, criação e edição de fichas, e a morte de um personagem ao atingir 100% de dano. Fica visível para todos que entram na campanha, mais recente primeiro.

**Kit médico**: só o narrador (criador da campanha) pode adicionar ou remover kits médicos de uma ficha. Quem criou a ficha pode apenas usar/gastar os kits que ela já tiver. Usar um kit reduz o dano em 30 pontos percentuais e consome uma unidade — o campo de ferimentos continua livre para editar manualmente caso o kit também resolva alguma limitação registrada ali.

**⚠️ Sobre segurança:** com login de verdade, as permissões agora são baseadas na conta autenticada (`uid`) e podem ser aplicadas nas regras do Firestore abaixo — não é mais só a interface escondendo botões. Ainda assim, as regras abaixo autorizam a escrita para "narrador da campanha OU dono da ficha" de forma ampla (por simplicidade); elas não distinguem no servidor, por exemplo, que só o narrador pode mexer no dano enquanto o dono da ficha só pode editar ferimentos — essa distinção mais fina continua sendo feita pela interface (que esconde os botões certos para cada pessoa). Para separar isso também no servidor seria necessário usar Cloud Functions ou regras bem mais elaboradas, o que fica fora do escopo de um site estático como este.

**Sobre as imagens:** o Firebase Storage passou a exigir o plano pago (Blaze) para novos projetos, então este site **não usa Storage**. As imagens de campanha e de personagem são redimensionadas no navegador (até 640px ou 480px de lado, JPEG comprimido) e guardadas como texto base64 direto dentro do próprio documento no Firestore — que continua 100% no plano gratuito (Spark). Isso mantém cada documento bem abaixo do limite de 1 MB do Firestore, então não há custo extra além do que você já paga (nada, no plano gratuito) pelas rolagens e contas.

### Regras do Firestore (adicionar às já existentes)

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /rolls/{roll} {
      allow read: if true;
      allow create: if request.auth != null;
      allow update, delete: if false;
    }
    match /usernames/{username} {
      allow read: if true;
      allow create: if request.auth != null
                    && !exists(/databases/$(database)/documents/usernames/$(username));
      allow update, delete: if false;
    }
    match /users/{uid} {
      allow read: if request.auth != null && request.auth.uid == uid;
      allow create: if request.auth != null && request.auth.uid == uid;
      allow update, delete: if false;
    }
    match /campaigns/{campaignId} {
      allow read: if true;
      allow create: if request.auth != null;
      allow update: if request.auth != null && (
        !('creatorUid' in resource.data) ||
        request.auth.uid == resource.data.creatorUid
      );
      allow delete: if false;

      match /characters/{characterId} {
        allow read: if true;
        allow create: if request.auth != null;
        allow update: if request.auth != null && (
          !('creatorUid' in resource.data) ||
          request.auth.uid == resource.data.creatorUid ||
          request.auth.uid == get(/databases/$(database)/documents/campaigns/$(campaignId)).data.creatorUid
        );
        allow delete: if false;
      }

      match /events/{eventId} {
        allow read: if true;
        allow create: if request.auth != null;
        allow update, delete: if false;
      }
    }
  }
}
```

A condição `!('creatorUid' in resource.data)` existe para não travar campanhas/fichas criadas **antes** de o site ter login (elas não têm esse campo salvo) — nesses casos, qualquer pessoa logada ainda consegue editar. Fichas e campanhas criadas depois do login já vêm com `creatorUid` preenchido e passam a valer só para quem criou.

Sem Firebase configurado, login, campanhas e personagens funcionam em modo local (localStorage + BroadcastChannel), com as imagens guardadas como base64 — funciona só entre abas do mesmo navegador, ideal para testar antes de configurar.

**Se aparecer "acesso negado pelo Firestore" ao salvar:** normalmente é porque as regras no console do Firebase ainda não foram atualizadas para a versão acima — copie o bloco de novo em **Firestore Database > Regras** e publique. Se o erro persistir, abra o console do navegador (F12) para ver o código de erro exato.

## Como funciona a rolagem

- Ao clicar no dado, no botão "ROLAR D6" ou apertar espaço, o dado gira e sorteia um valor de 1 a 6.
- O resultado é enviado ao banco (Firestore ou modo local) e aparece no terminal com horário, handle e valor, para todo mundo conectado.
- O terminal mostra as últimas 60 rolagens.
