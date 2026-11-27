# Reverse Life

Site de apoio a mesas de RPG de terror: campanhas com fichas de personagem, inventário, dano, regras opcionais e **rolagem de dados dentro de cada campanha** (D6 ou D20 + atributos), com histórico compartilhado em tempo real. Visual preto e vermelho, estilo terminal/glitch.

## Arquivos

- `index.html` — estrutura da página (abas, modais, terminal, campanhas)
- `style.css` — identidade visual (preto/vermelho, terminal, glitch no título)
- `firebase-config.js` — onde você cola as credenciais do seu Firebase
- `firebase-core.js` — inicialização compartilhada do Firebase (Firestore + Storage)
- `identity.js` — login, criar conta e sessão (Firebase Authentication)
- `rules.js` — regras puras do jogo: atributos, estados do corpo, sangramento, testes de D20 e ervas
- `dice-data.js` — tabelas do D6, compartilhadas entre o dado global e o das campanhas
- `sound.js` — efeitos sonoros sintetizados (sem arquivos de áudio)
- `app.js` — lógica do dado, animação e feed em tempo real
- `campaigns.js` — lógica de campanhas, personagens, dano, ferimentos, inventário e fome/sede
- `icons.js` — ícones SVG de traço usados na ficha
- `olympus-data.js`, `percy-engine.js`, `percy.js` — sistema Percy Jackson (dados dos deuses, regras e interface)
- `manifest.json` — metadados do app instalável (PWA): nome, cores, ícones
- `sw.js` — service worker: cacheia os arquivos do site pra abrir mais rápido e funcionar offline
- `pwa.js` — registra o service worker
- `icons/` — ícones do app em vários tamanhos (gerados no mesmo estilo visual do dado do site)

## Notificações

Um ícone de sino (🔔/🔕) no topo da página liga ou desliga notificações do navegador para quem estiver com uma campanha aberta. Quando ativadas, a pessoa é avisada automaticamente quando:

- o **dano** de uma ficha que ela criou muda (subiu ou desceu);
- a **fome** ou a **sede** de uma ficha que ela criou diminui — com um aviso especial quando chega a zero;
- um **item novo** aparece no inventário de uma ficha que ela criou;
- **qualquer personagem da campanha morre** (chega a 100% de dano) — essa notificação vale pra todo mundo com a campanha aberta, não só pra quem criou a ficha.

**Como ativar:** clique no sino no topo da página; o navegador vai pedir permissão de notificação. Depois de concedida, clicar de novo no sino liga/desliga o aviso sem precisar mexer nas configurações do navegador.

**⚠️ Limitação importante:** como o site não usa nenhum serviço pago de push (Firebase Cloud Messaging exigiria o plano Blaze), essas notificações só funcionam **enquanto o site estiver aberto em alguma aba do navegador** — mesmo que essa aba esteja em segundo plano (minimizada, em outra aba, com a tela do celular bloqueada em alguns casos) — e com a campanha em questão aberta nela. Elas **não** funcionam com o navegador/app totalmente fechado. Para notificações de verdade com o app fechado, seria necessário migrar para o plano pago do Firebase e implementar push notifications de servidor — o que fica fora do escopo atual.

## Instalar como app (PWA)

O site pode ser adicionado à tela inicial do celular (ou instalado no computador) e abrir como se fosse um app nativo, sem barra de endereço do navegador.

**Requisito importante:** PWAs só funcionam servidos via **HTTPS** (ou `localhost` durante testes) — não funciona pelo `file://` nem por HTTP puro. Qualquer hospedagem HTTPS normal (Firebase Hosting, Vercel, Netlify, GitHub Pages) já atende isso.

**Android (Chrome):** ao visitar o site, aparece um banner ou o menu (⋮) mostra a opção **"Instalar app"** / **"Adicionar à tela inicial"**.

**iPhone/iPad (Safari):** toque no ícone de compartilhar (□ com uma seta) → **"Adicionar à Tela de Início"**. O Safari não mostra instalação automática como o Chrome — esse é o único caminho no iOS.

**Computador (Chrome/Edge):** um ícone de instalação aparece na barra de endereço, à direita.

Depois de instalado, o site abre em janela própria, com o ícone do dado vermelho na tela inicial/menu de apps, sem mostrar a interface do navegador.

**Atualizando o site depois de instalado:** (desde a versão `v9`, o service worker busca sempre a versão mais nova na rede e só usa o cache quando está offline, o que evita misturar arquivos antigos e novos depois de uma atualização.) o service worker guarda uma cópia dos arquivos (HTML/CSS/JS) para abrir mais rápido e funcionar minimamente offline. Sempre que você publicar uma alteração no código, abra `sw.js` e aumente o número em `CACHE_NAME` (ex: de `"reverse-life-v1"` para `"reverse-life-v2"`) — isso força quem já instalou o app a baixar a versão nova, em vez de continuar vendo a versão antiga guardada em cache. Sem esse passo, atualizações podem demorar a aparecer para quem já tem o app instalado.

## Como rodar

Basta abrir `index.html` num servidor local (por exemplo, com a extensão "Live Server" do VS Code, ou `python3 -m http.server` na pasta) e acessar pelo navegador. Não pode ser aberto direto com duplo-clique (`file://`) porque o site usa módulos JavaScript (`type="module"`), que exigem `http://`.

**Sem nenhuma configuração**, o site já funciona: as rolagens aparecem no terminal entre abas abertas no mesmo navegador (usando `localStorage`), então dá pra testar tudo sozinho antes de configurar o resto.

## Deixando o terminal compartilhado de verdade (entre qualquer pessoa, de qualquer lugar)

Para que campanhas, fichas e rolagens apareçam para todo mundo — e não só entre abas do seu navegador — é preciso um banco de dados em tempo real. O site já vem pronto para usar o **Firestore do Firebase** (gratuito no plano usado aqui).

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

## Sistemas de dado (tabelas de resultado do D6)

A rolagem existe **somente dentro das campanhas**: cada campanha tem o seu painel `/dev/dados`, e todo resultado é registrado no histórico dela. Em campanhas D6, o painel oferece três sistemas de tabela:

- **🎲 Tabela do Dado** — resultado individual para cada face (1 a 6), de Morte Instantânea a Fuga Perfeita.
- **⚙️ Variação Simplificada** — dois blocos: 1–3 é Dano, 4–6 é Escapou.
- **🎯 Dado de Execução** — usado quando o personagem é alcançado e há chance de execução, de Ataque Devastador a Escape Perfeito.

Depois de cada rolagem, a descrição completa do resultado aparece no painel. Quando sai o pior resultado de uma tabela (🔴), toca o alarme de terminal.

## Campanhas de RPG

Uma segunda aba, "📖 Campanhas", funciona como salas: qualquer pessoa pode criar uma campanha (nome, descrição, imagem) e qualquer pessoa que acessar o site pode entrar nela e criar uma ficha de personagem (nome completo, gênero, ponto forte, ponto fraco, foto). Todos os personagens da campanha aparecem para todo mundo.

**Fichas compactas**: cada personagem aparece como uma linha compacta (miniatura, nome, gênero, barra de dano) — clique nela pra expandir e ver traços, ferramenta de dano, ferimentos e inventário. Isso evita ter que rolar a página inteira quando há várias fichas na campanha. Um campo de busca por nome, acima da lista, ajuda a achar uma ficha específica rapidamente.

**Barra de dano (0–100%)**, com faixas de status:
- 0–24%: estável
- 25–49%: ferido
- 50–74%: muito ferido
- 75–99%: estado crítico
- 100%: morte

Só quem criou a campanha pode aumentar ou diminuir a barra de dano de qualquer personagem dela.

**Ferimentos e limitações**: um campo de texto livre na ficha, editável por quem criou a campanha OU por quem criou aquela ficha específica.

**Editar ficha**: quem criou uma ficha pode editá-la depois de pronta — nome completo, gênero, ponto forte, ponto fraco e foto — através do botão "✎ editar" que aparece no topo do card. Ao trocar a foto, a antiga é substituída; deixando o campo de foto em branco, a foto atual é mantida. Dano, ferimentos e inventário continuam com suas próprias regras de permissão, separadas dessa edição.

**Inventário**: cada ficha tem uma lista de itens (nome, descrição, quantidade e categoria — 🍗 alimento, 🥤 bebida, 🗡️ arma, 🎒 equipamento ou 💉 cura). Só o narrador pode adicionar itens, aumentar/diminuir a quantidade ou excluir um item. Tanto o narrador quanto quem criou a ficha podem **transferir** um item (ou parte da quantidade) para outra ficha da mesma campanha — como se um personagem entregasse o item a outro. Se a ficha de destino já tiver um item com o mesmo nome e categoria, as quantidades somam em vez de duplicar a entrada.

**Sistema de fome e sede (opcional)**: o narrador liga ou desliga esse sistema pra campanha inteira no painel de regras (`/etc/regras.cfg`). Quando ativo, cada ficha ganha duas barras de 3 unidades — 🍗 fome e 💧 sede:
- O narrador pode ajustar cada uma manualmente, ficha por ficha (+/-).
- O narrador também tem dois botões de ação em massa que diminuem 1 de fome ou 1 de sede de **todas as fichas da campanha de uma vez** — útil pra marcar a passagem de um dia, por exemplo.
- Itens de alimento e bebida no inventário ganham um botão **"consumir"** (disponível pro narrador ou pra quem criou a ficha): consumir um alimento dá +1 de fome, consumir uma bebida dá +1 de sede, e reduz a quantidade do item em 1 (removendo-o se chegar a zero).
- **Penalidade por fome/sede zerada**: no mesmo painel, o narrador define uma porcentagem fixa (padrão 10%). Sempre que fome ou sede de uma ficha **já estiver em 0** e for reduzida de novo (manualmente ou pela ação em massa), em vez de tentar ir abaixo de zero, a ficha sofre esse tanto de dano — simulando o desgaste de continuar sem comer ou beber. Se esse dano levar a ficha a 100%, a morte é registrada normalmente.
- Todas essas mudanças ficam registradas no histórico da campanha.

**Histórico de eventos**: cada campanha tem um mini-log próprio, separado do terminal de dados, registrando o que acontece com as fichas ao longo do tempo — mudanças de dano (quem aplicou, quanto e o novo total), uso/adição/remoção de itens do inventário, edições de ferimentos, criação e edição de fichas, e a morte de um personagem ao atingir 100% de dano. Fica visível para todos que entram na campanha, mais recente primeiro.

**Regras opcionais da campanha** (painel `/etc/regras.cfg`, que o narrador usa para ligar/desligar e que pode ser recolhido para ocupar menos espaço):

- 🎲 **Sistema de dados por campanha**: a rolagem acontece somente dentro de cada campanha (painel `/dev/dados`) e o resultado vai pro histórico dela. O narrador escolhe entre **D6** (com as 3 variações de tabela) e **D20 + atributos**.
- **D20 + atributos**: ao criar uma ficha numa campanha D20, a pessoa distribui exatamente **10 pontos** entre Força, Agilidade, Vigor, Carisma e Intelecto (máx. 5 em cada) — depois de criada, não dá mais pra alterar. No painel de dados dá pra rolar um **d20 puro**; pra rolar um **atributo**, o dono da ficha clica no atributo na própria ficha e escolhe o teste (Normal, Difícil ou Arriscado) — a rolagem é automática e o site mostra o total e a conta separada. Todo mundo vê os atributos das fichas da campanha, mas só o dono (ou o narrador, em qualquer ficha) pode rolá-los. Testes: **Normal** (10+), **Difícil** (15+) e **Arriscado** (18+), com sucesso/falha automáticos. Cada ponto de **Vigor** soma +5 ao limite de dano (Vigor 2 = morre em 110%) e desloca na mesma medida os limites entre os estados do corpo.
- 🌀 **Sanidade**: barra de 0 a 100% ajustada pelo narrador; ao chegar em 100% a ficha fica **insana** (perde o juízo, não luta direito, pode ferir colegas e chama atenção) e ganha um visual próprio.
- 🩸 **Sangramento**: liga os estados do corpo ao dano — **Normal** (até 50%), **Mancando** (51–80%) e **No Chão** (81–99%) — e permite ao narrador marcar uma ficha como **Sangrando**: 5% de dano a cada 10 minutos durante 1 hora (30% no total). O desconto é aplicado automaticamente (pelo navegador do narrador ou do dono da ficha que estiver com a campanha aberta; o que passou enquanto ninguém estava online é compensado na próxima abertura). Itens de **cura** e a **Erva Vermelha** encerram o sangramento, e o narrador também pode parar manualmente.
- 🌿 **Ervas** (exigem sanidade ou sangramento ativos): itens prontos (ao adicionar um item, escolha o **item pronto** e nome e descrição curta já vêm preenchidos) — 🌿 **Verde** (restaura vida, usa a mesma % da cura da campanha, mas não para o sangramento), 🌺 **Vermelha** (para o sangramento) e 🫐 **Azul** (restaura 20% de sanidade). O botão **🧪 misturar ervas** (narrador ou dono da ficha) combina **2 ou 3 ervas de cores diferentes**: gasta uma de cada e aplica os efeitos de todas ao mesmo tempo, com **bônus de eficiência** — **+25%** na mistura de 2 e **+35%** na de 3 (arredondado). Com a cura padrão de 30% e a sanidade de 20%: Verde+Vermelha cura **38%** e para o sangramento; Verde+Azul cura **38%** e restaura **25%** de sanidade; Vermelha+Azul para o sangramento e restaura **25%** de sanidade (sem vida); Verde+Vermelha+Azul cura **41%**, para o sangramento e restaura **27%** de sanidade. A cura segue a % de cura configurada pelo narrador (o bônus é aplicado por cima). No formulário, escolha a primeira, a segunda e, se quiser, a terceira erva; o texto abaixo mostra o efeito já com o bônus antes de confirmar.

- 🎒 **Carga pela Força** (só em campanhas D20): cada ficha carrega **5 itens + 2 por ponto de Força** (Força 2 = 9 itens). O limite conta as unidades (3 ervas ocupam 3 espaços). O narrador não consegue adicionar nem aumentar itens além da capacidade, e uma transferência só acontece se a ficha de destino tiver espaço. A ficha mostra o contador 🎒 usados/limite.
- ⚠️ **Desvantagem no D20**: enquanto a ficha estiver **Mancando** ou **No Chão** (sistema de sangramento ativo), **todos os testes dela** — atributos rolados na ficha e o teste de sanidade — saem com desvantagem: o site rola 2d20 e fica com o menor. A ficha avisa isso (selo "⚠️ desvantagem", aviso no estado do corpo e no menu de rolagem) e a desvantagem só acaba quando ela se cura e volta ao estado Normal. O d20 puro do painel não pertence a nenhuma ficha e não sofre desvantagem.
- 🌀 **Teste de sanidade** (botão do narrador, só com a sanidade ativa): o narrador escolhe a dificuldade, o abalo mental (%) e quais fichas participam. O site rola Carisma (1d20 + Carisma; em campanhas D6, 1d20 puro) por cada ficha, aplica o abalo em quem falhar, mostra quem passou e quem falhou e registra tudo no histórico.

Nenhuma regra nova do Firestore é necessária: tudo reaproveita os documentos de campanha, ficha e histórico que já existem.

**Itens de cura**: em vez de um sistema fixo de "kits médicos", a cura agora é só mais uma categoria de item (💉 Cura) no inventário — pode ser qualquer coisa que o narrador queira (um kit de primeiros socorros, um remédio, magia de cura, etc.). Itens dessa categoria ganham um botão **"usar (cura)"**, disponível pro narrador ou pra quem criou a ficha: usar reduz o dano em uma porcentagem fixa (**30% por padrão**) e consome uma unidade do item. Essa porcentagem pode ser ajustada pelo narrador num painel acima da lista de personagens, valendo para todos os itens de cura da campanha.

**⚠️ Sobre segurança:** com login de verdade, as permissões agora são baseadas na conta autenticada (`uid`) e podem ser aplicadas nas regras do Firestore abaixo — não é mais só a interface escondendo botões. Ainda assim, as regras abaixo autorizam a escrita para "narrador da campanha OU dono da ficha" de forma ampla (por simplicidade); elas não distinguem no servidor, por exemplo, que só o narrador pode mexer no dano enquanto o dono da ficha só pode editar ferimentos — essa distinção mais fina continua sendo feita pela interface (que esconde os botões certos para cada pessoa). Para separar isso também no servidor seria necessário usar Cloud Functions ou regras bem mais elaboradas, o que fica fora do escopo de um site estático como este.

**Sobre as imagens:** o Firebase Storage passou a exigir o plano pago (Blaze) para novos projetos, então este site **não usa Storage**. As imagens de campanha e de personagem são redimensionadas no navegador (até 640px ou 480px de lado, JPEG comprimido) e guardadas como texto base64 direto dentro do próprio documento no Firestore — que continua 100% no plano gratuito (Spark). Isso mantém cada documento bem abaixo do limite de 1 MB do Firestore, então não há custo extra além do que você já paga (nada, no plano gratuito) pelas rolagens e contas.

### Regras do Firestore (adicionar às já existentes)

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // narrador = dono da campanha OU co-narrador (uid em narratorUids)
    function isNarrator(campaignId) {
      let c = get(/databases/$(database)/documents/campaigns/$(campaignId)).data;
      return request.auth != null && (request.auth.uid == c.creatorUid || request.auth.uid in c.get('narratorUids', []));
    }
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
        request.auth.uid == resource.data.creatorUid ||
        // co-narrador: edita tudo, menos a lista de narradores e o dono
        (request.auth.uid in resource.data.get('narratorUids', [])
          && !request.resource.data.diff(resource.data).affectedKeys().hasAny(['narratorUids', 'coNarrators', 'creatorUid', 'creator'])) ||
        // co-narrador pode sair sozinho da lista
        (request.auth.uid in resource.data.get('narratorUids', [])
          && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['narratorUids', 'coNarrators'])
          && !(request.auth.uid in request.resource.data.narratorUids)
          && request.resource.data.narratorUids.size() == resource.data.narratorUids.size() - 1)
      );
      allow delete: if false;

      match /characters/{characterId} {
        allow read: if true;
        allow create: if request.auth != null;
        allow update: if request.auth != null && (
          !('creatorUid' in resource.data) ||
          request.auth.uid == resource.data.creatorUid ||
          isNarrator(campaignId) ||
          request.resource.data.diff(resource.data).affectedKeys().hasOnly(['items'])
          // Jogos Vorazes: ataques e efeitos aplicados na hora, sem confirmação do alvo
          || request.resource.data.diff(resource.data).affectedKeys().hasOnly(['items', 'damage', 'fx', 'bleeding', 'sanity', 'infection', 'hunger', 'thirst'])
        );
        allow delete: if false;
      }

      match /events/{eventId} {
        allow read: if true;
        allow create: if request.auth != null;
        allow update, delete: if false;
      }

      // bestiário: monstros do narrador (só o narrador cria, edita e exclui)
      match /monsters/{monsterId} {
        allow read: if true;
        allow create, delete: if request.auth != null
          && isNarrator(campaignId);
        allow update: if request.auth != null && (
          isNarrator(campaignId)
          // Jogos Vorazes: qualquer jogador pode ferir uma Ameaça (só dano e efeitos)
          || request.resource.data.diff(resource.data).affectedKeys().hasOnly(['damage', 'fx'])
        );
      }

      // Jogos Vorazes: estoque da Cornucópia (doc "cornucopia") — jogadores só mexem no campo stock
      match /arena/{docId} {
        allow read: if true;
        allow create, delete: if request.auth != null
          && isNarrator(campaignId);
        allow update: if request.auth != null && (
          isNarrator(campaignId)
          || request.resource.data.diff(resource.data).affectedKeys().hasOnly(['stock'])
        );
      }

      // Jogos Vorazes: presentes de patrocinadores e banquete — jogadores só baixam a quantidade (qty)
      match /drops/{dropId} {
        allow read: if true;
        allow create, delete: if request.auth != null
          && isNarrator(campaignId);
        allow update: if request.auth != null && (
          isNarrator(campaignId)
          || request.resource.data.diff(resource.data).affectedKeys().hasOnly(['qty'])
        );
      }

      // fila de ataques/efeitos entre fichas (sistema Percy Jackson)
      match /hits/{hitId} {
        allow read: if true;
        allow create: if request.auth != null;
        allow update: if request.auth != null && (
          isNarrator(campaignId) ||
          request.auth.uid == get(/databases/$(database)/documents/campaigns/$(campaignId)/characters/$(resource.data.targetId)).data.creatorUid
        ) && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['applied', 'appliedBy', 'appliedAt']);
        allow delete: if false;
      }
    }
  }
}
```

A coleção `/monsters` guarda o **bestiário** (só o narrador escreve). **Atenção:** a leitura é pública como no resto do app, então monstros "ocultos" ficam escondidos na interface, mas não de quem abrir o console do navegador. A coleção `/hits` é a **fila de ataques e efeitos entre fichas** do sistema Percy Jackson. Quando um jogador ataca ou usa um poder em uma ficha que não é dele, o site não consegue alterar o dano dessa ficha (só o narrador e o dono podem), então grava um "hit" ali. Quem tem permissão (o narrador ou o dono da ficha-alvo), assim que abrir a campanha, aplica o hit automaticamente e o marca como aplicado — tudo dentro de uma transação, então nada é aplicado duas vezes. **Sem essa regra publicada, ataques entre fichas de donos diferentes não funcionam** (ataques do próprio narrador e em fichas próprias funcionam normalmente).

**Jogos Vorazes — regras novas (publique-as para o sistema funcionar online).** As coleções `/arena` (estoque da Cornucópia) e `/drops` (presentes e banquete) guardam o que os jogadores reivindicam: a transação do site baixa o estoque e põe o item na ficha de uma vez só, então vale quem reivindicar primeiro e nunca passa do estoque. Como os ataques desse sistema são aplicados **na hora, sem confirmação**, as fichas passam a aceitar de qualquer pessoa logada alterações em `damage`, `fx`, `bleeding`, `sanity`, `infection`, `hunger`, `thirst` e `items` (e as Ameaças aceitam `damage` e `fx`). O custo é que quem abrir o console do navegador também consegue mexer nesses campos; para mesas de amigos isso costuma ser aceitável. Se o site não conseguir gravar (regras antigas), ele cai sozinho na fila de hits do Percy Jackson. O veneno de cada prato da Última Ceia fica escondido só na interface (como os monstros ocultos).

**Co-narradores.** O dono da campanha pode dar o cargo de narrador a outros usuários (pelo @nome, no painel "narradores" da campanha). Eles ficam em `narratorUids` (usado pelas regras) e `coNarrators` (nome para exibir) e passam a ter as mesmas funções do dono: fichas, itens, regras, cena, arena, eventos, Ameaças e hits. Só o dono nomeia ou remove co-narradores, e um co-narrador pode sair sozinho. **Publique as regras novas acima** (a função `isNarrator` substitui as checagens de `creatorUid` da campanha).

A condição `!('creatorUid' in resource.data)` existe para não travar campanhas/fichas criadas **antes** de o site ter login (elas não têm esse campo salvo) — nesses casos, qualquer pessoa logada ainda consegue editar. Fichas e campanhas criadas depois do login já vêm com `creatorUid` preenchido e passam a valer só para quem criou.

A condição `request.resource.data.diff(resource.data).affectedKeys().hasOnly(['items'])` existe especificamente para a **transferência de itens**: como enviar um item mexe na ficha de quem envia *e* na ficha de quem recebe ao mesmo tempo, essa regra libera qualquer pessoa autenticada a alterar **somente o campo `items`** de qualquer ficha da campanha — sem abrir brecha para mexer em dano, ferimentos ou qualquer outro campo de uma ficha que não seja sua.

Sem Firebase configurado, login, campanhas e personagens funcionam em modo local (localStorage + BroadcastChannel), com as imagens guardadas como base64 — funciona só entre abas do mesmo navegador, ideal para testar antes de configurar.

**Se aparecer "acesso negado pelo Firestore" ao salvar:** normalmente é porque as regras no console do Firebase ainda não foram atualizadas para a versão acima — copie o bloco de novo em **Firestore Database > Regras** e publique. Se o erro persistir, abra o console do navegador (F12) para ver o código de erro exato.

## Sistema Percy Jackson (semideuses)

Regra opcional da campanha, ligada pelo narrador no painel `/etc/regras.cfg` (**exige o sistema D20**). **Ao ativar, todas as fichas mudam**: o site pede confirmação antes. Desativar volta ao visual normal sem apagar os dados do sistema.

**O que muda na ficha**

- **Personalidade** no lugar de ponto forte/fraco.
- **Parente divino**, escolhido na criação entre 16 deuses (Zeus, Hécate, Poseidon, Deméter, Ares, Atena, Apolo, Circe, Hefesto, Afrodite, Hermes, Dionísio, Hades, Íris, Hipnos e Morfeu). O semideus começa **indeterminado**; ao clicar em *aguardar o sinal* aparecem os deuses, e depois de escolher o parente e o presente e **confirmar a reivindicação** roda a **cena de reivindicação**: a tela escurece, o símbolo do deus brilha, o nome aparece e os poderes (2 comuns, ultimate e o presente) são revelados um a um (há botão *pular*, e a cena respeita a preferência de movimento reduzido do sistema). A escolha é definitiva, mas dá para rever a cena pelo botão na ficha em criação.
- **Poderes**: 2 comuns + 1 ultimate do parente divino, todos com botão de uso.
- **Presente divino**: um por ficha, entre 3 opções do parente. **Cada presente só pode ser escolhido por uma ficha da campanha** (os já escolhidos aparecem bloqueados).
- **Soco**: ataque padrão, 1d4 + Força.
- **Dracmas de Ouro**: caixa pequena; só o narrador altera.
- **Inventário**: alimento e bebida saem. Novas categorias: **arma** (atributo do ataque, dado de dano, corpo a corpo ou à distância), **armadura** e **escudo** (quanto absorvem por golpe e a durabilidade total) e **objeto mágico** (efeito em texto, com teste e dano opcionais). Cura e equipamento continuam como eram.
- Fichas criadas **antes** da ativação ficam sem parente divino; o dono escolhe pelo botão ✎.

**Como funcionam as rolagens**

- Todo uso abre uma janela onde você escolhe a **dificuldade** (Normal 10+, Difícil 15+, Arriscado 18+, que representa a defesa do alvo), as **opções** do poder e os **alvos** (quem sofre e quem recebe cura ou proteção).
- Teste do atacante: **1d20 + atributo** (+/- efeitos ativos). Se falhar, nada acontece e o poder entra em recarga.
- **Dano**: dados do poder/arma. Armas **corpo a corpo** (e o soco) somam a **Força**; armas **à distância** não. **20 natural**: dano **×2** (×3 em arma à distância).
- **Resistência do alvo**: rolada automaticamente (1d20 + atributo). Contra Normal (10+) ou, nos poderes de controle, contra o total do atacante (empate favorece o atacante).
- **Unidade de dano**: 1 ponto = 1% de dano na ficha; cura de N = -N%. O limite continua sendo 100% + 5% por ponto de Vigor.
- **Ordem de defesa** ao receber dano: reduções por golpe (ex.: -5 em todo dano) → barreiras (ex.: Égide, absorve 15) → armaduras/escudos equipados (absorvem até o valor definido e perdem a mesma quantidade de durabilidade; chegando a zero **quebram**; o narrador pode reparar) → o resto vira dano na ficha.
- **Custos**: poderes com custo (ex.: Ira do Olimpo, 15%) aplicam o dano ao próprio usuário. Se o custo mataria, a ficha fica em 1% do limite e ganha o efeito **Inconsciente**.

**Cenário da cena**

Painel logo abaixo das regras (só no sistema Percy Jackson). O narrador digita o nome do lugar (opcional) e marca **etiquetas** do ambiente; todos os jogadores veem o cenário em tempo real, só leitura.

- **Etiquetas**: 🌊 Perto de água · 🌧️ Chovendo · ⛈️ Tempestade · 🌑 Sombras · 🌿 Vegetação · 🏜️ Ambiente seco · ☀️ Sol forte · 🌙 Noite · 🔥 Fogo por perto · 🏢 Superfície artificial. Mudar o cenário aparece no histórico ("O narrador mudou o cenário: Bosque do lago — 🌧️ Chovendo...").
- **Opções preenchidas sozinhas** na janela de uso, com a marca "cenário" (dá para desmarcar na mão): *Alvo úmido* (Descarga Elétrica) com chuva ou tempestade; *Sem fonte de água próxima* (Pressão Abissal) quando há cenário e nem água nem chuva; *Em contato com água natural* (Revitalização das Marés) com água; *Ambiente completamente seco* (Cólera dos Sete Mares) com ambiente seco. Com o cenário vazio tudo continua manual, como antes.
- **Avisos de requisito** (não bloqueiam; o narrador decide): Manto da Escuridão pede sombras; Essência Revigorante e Despertar da Mãe-Terra pedem vegetação; Raízes Aprisionadoras, Despertar da Mãe-Terra e Semente da Renovação não combinam com superfície artificial.
- **Clima na tela**: chuva e tempestade (riscos de chuva), noite (tom azul), sol (luz quente) e sombras (bordas escuras) ficam sutis, abaixo da vinheta. Cada pessoa desliga com a caixa "clima na tela"; respeita "movimento reduzido".
- As regras de cada poder ficam em `olympus-data.js` (`opt.auto`, `need`, `not`), fáceis de ampliar. A lógica está em `scene.js`.

**Bestiário (monstros do narrador)**

Seção própria no fim da página da campanha, só existe com o sistema Percy Jackson ligado.

- **Fichas de monstro**: nome, tipo, ícone, **vida em pontos**, **couraça natural** (reduz um valor fixo de cada golpe), os 5 atributos (sem limite de pontos) e uma lista de **ataques**. Cada ataque tem atributo do teste, dado de dano, corpo a corpo (soma a Força do monstro) ou à distância, número de alvos, resistência opcional (atributo do alvo contra Normal 10+) e um **efeito** opcional em quem falhar (rótulo, modificador de atributo/ataque/percepção e duração em minutos ou ações).
- **11 modelos prontos** para começar: Fúria, Minotauro, Hidra, Quimera, Cérbero, Harpia, Górgona, Ciclope, Esqueleto guerreiro, Cão infernal e Drakon. Dá para ajustar tudo antes de salvar.
- **Mesma mecânica das fichas**: o narrador clica no ataque, escolhe os alvos e a dificuldade, e o site rola o teste, o dano, a resistência de cada alvo, aplica efeitos e narra no histórico. Os jogadores atacam monstros pela janela de uso de poderes, armas ou soco (os monstros revelados aparecem como alvos). Efeitos, barreiras e couraça valem nos dois sentidos.
- **Oculto ou revelado**: monstros novos começam ocultos (só o narrador vê). Ao revelar, o histórico anuncia "Um(a) Minotauro surge diante do grupo!". Os jogadores veem só o nome, o ícone e uma barra com o estado (ileso, arranhado, ferido, muito ferido, quase morto, derrotado), sem números.
- **Ferramentas do narrador**: ajuste de vida (-10/-5/+5/+10), restaurar (vida cheia, sem efeitos), editar, duplicar e excluir. Ao chegar a zero de vida o monstro é marcado como derrotado e o histórico avisa.
- Ataques de jogadores contra monstros entram na mesma **fila de hits** e são aplicados quando o narrador abre a campanha.

**Frases de invocação**

- Cada uma das 148 ações de poderes e presentes tem uma **frase de narração** própria (ex.: Ira do Olimpo: "As nuvens se fecham sobre o acampamento..."). Ela aparece em itálico no **histórico da campanha**, logo abaixo da linha com os números, e no topo da janela de resultado. Soco, armas e objetos mágicos têm frases genéricas (com o nome do item), há frases para quando o teste falha e um complemento extra quando sai 20 natural. As frases ficam em `olympus-lines.js`, uma por `deus:poder:ação`, fáceis de editar.

**Efeitos de tela e som**

- Ao usar um poder ou presente com sucesso, cada deus tem o seu efeito e o seu som, todos sintetizados (sem arquivos de áudio): raio e clarão no Zeus, onda e anéis d'água no Poseidon, escuridão se fechando no Hades, círculo de fogo violeta na Hécate, brotos e folhas na Deméter, cortes vermelhos no Ares, o sol no Apolo, o arco-íris varrendo a tela na Íris, redemoinho no Circe, brasas na Hefesto, pétalas na Afrodite, rastros de velocidade no Hermes, bolhas de vinho no Dionísio, feixe de luz na Atena, névoa e "z" no Hipnos e ondas oníricas no Morfeu.
- **Ultimates** ocupam a tela inteira por cerca de 1,4 segundo, com o nome do poder em letras grandes, som mais grave e estrondo final (e a tela treme nos deuses mais "pesados").
- **20 natural** ganha uma explosão dourada com "★ 20 NATURAL ★" e um arpejo cintilante; vale também para soco e armas.
- Há uma caixa "efeitos de tela e som" na janela de uso para desligar; o som também respeita o botão de mudo do site. Com "movimento reduzido" ativado no sistema, os efeitos viram só um tom de cor discreto. Nenhum efeito pisca rápido demais (no máximo dois clarões, separados por mais de 300 ms).

**Efeitos ativos, recargas e alvos**

- Bônus, penalidades, barreiras e estados aparecem como **chips** na ficha, com tempo restante, número de ações ou de golpes. Modificadores de atributo entram nas rolagens e aparecem ao lado do atributo. O dono ou o narrador podem gastar uma ação (-1) ou remover um efeito.
- Efeitos com tempo somem sozinhos (inclusive o dano de "fim de efeito" da Carnificina de Ares).
- Recargas em minutos têm contagem regressiva; "1x por combate" e "1x por dia" ficam marcados como usados até o dono ou o narrador clicar em ↺. O narrador tem "recarregar tudo" em *Controles do narrador*.
- **Ataques entre fichas**: se você tem permissão na ficha-alvo (é o narrador ou o dono), o efeito é aplicado na hora. Se não, vai para a **fila de hits** (regra do Firestore acima) e é aplicado por quem tiver permissão assim que abrir a campanha.

**Arquivos**: `olympus-data.js` (os 16 deuses, 48 poderes e 48 presentes, extraídos do PDF), `percy-engine.js` (regras puras, testáveis fora do navegador), `percy.js` (interface e integração) e `percy-fx.js` (efeitos de tela; os sons ficam em `sound.js`) `olympus-lines.js` (frases de invocação), `bestiary.js` e `bestiary-data.js` (bestiário) e `scene.js` (cenário da cena).

## Como funciona a rolagem

- Entre numa campanha e use o painel `/dev/dados`: no D6, escolha a tabela e clique em **ROLAR D6**; no D20, clique em **ROLAR D20 (PURO)** ou clique num atributo da sua ficha e escolha o teste.
- O resultado aparece no painel e é registrado no histórico da campanha, com o nome de quem rolou.
- A rolagem exige estar logado; só o narrador pode escolher o sistema de dados da campanha (D6 ou D20).


## Jogos Vorazes — visual da arena (efeitos)

- **Mapa da arena** (painel da arena): Cornucópia no centro e Norte/Leste/Sul/Oeste ao redor. Mostra os locais cadastrados, os presentes caídos (🪂), os tributos de cada região (pontos coloridos pelo distrito) e a região atingida **pisca** na cor do evento enquanto ele está ativo.
- **Paraquedas animado**: quando cai (ou é revelado) um presente, um paraquedas prateado desce pela tela de todos e o card ganha brilho dourado por alguns segundos.
- **Tributo caído**: ao chegar no limite de dano, todos que estão com a campanha aberta ouvem o canhão e veem uma tela escura com foto, nome e distrito (fecha sozinha ou ao clicar).
- **Clima dos eventos**: efeito curto (cerca de 8 s) e translúcido, abaixo do cabeçalho e dos modais para não atrapalhar a leitura: chuva vermelha, flocos, cinzas, tremor, onda, canários, olhos dos predadores, esporos, brilho dourado e sirene. A Bomba Aérea ganha um clarão com rachaduras e tremor 1 minuto depois do alerta (só para quem estava com a campanha aberta no alerta).
- **Tributos restantes**: contador no topo da campanha, com um ponto por tributo e a lista das últimas baixas.
- Os efeitos só tocam para eventos e presentes **novos** (ao abrir a campanha nada é repetido). Respeitam "movimento reduzido" do sistema, o botão de efeitos do Percy Jackson e o mudo do site. Os sons são sintetizados (sem arquivos de áudio).

### Jogos Vorazes — identidade do distrito na ficha

- **Faixa e selo:** cada ficha ganha uma faixa lateral na cor do distrito, o selo (brasão + número) no canto da foto e o brasão como marca d'água ao fundo da ficha aberta. A passiva aparece em destaque logo no topo da ficha.
- **Painel de status único:** dano, sanidade, fome e sede ficam alinhados em barras com ícones (fome e sede em 3 blocos, com os botões −/+ do narrador). Embaixo ficam as etiquetas de condição: sangrando (com contagem e botão parar), infectado (próxima perda), insano, desvantagem e os efeitos ativos (veneno, evento, fogo etc., com seus tempos).
- **Silhueta do tributo:** a figura se enche de baixo para cima com a vida restante e muda de tom por estado (cor do distrito em Normal, âmbar em Mancando, vermelho em No Chão, cinza quando cai).
- **Linha recolhida:** com a ficha fechada já aparecem distrito, dano, sanidade, fome, sede, a arma mais forte do inventário (com munição), o escudo equipado e alertas (🩸 sangrando, 🦠 infectado, ☠ envenenado, ⚡ em evento, ⚠ desvantagem...).
- Os efeitos de som e tela agora são à prova de falha: se o navegador não tocar áudio, a ficha continua atualizando normalmente.
