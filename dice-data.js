// Tabelas de resultado do D6 (compartilhadas entre o dado global e o das campanhas)
export const DICE_TABLES = {
  tabela: {
    label: "Tabela do Dado",
    intro: "Quando uma ação decisiva de ataque, defesa ou fuga for exigida, role o dado. Os resultados são os seguintes, dependendo de como seu personagem está:",
    entries: {
      1: { emoji: "🔴", title: "Morte Instantânea", desc: "O ataque é fatal. O personagem morre no ato." },
      2: { emoji: "🟠", title: "Dano Crítico/Quase Morte", desc: "O personagem sofre um dano massivo e fica incapacitado. Entra em estado de sangramento e morrerá se nenhum aliado ajudar a tempo." },
      3: { emoji: "🟡", title: "Acerto Crítico e Lentidão", desc: "O golpe debilita gravemente o personagem, deixando-o muito lento. O jogador pode tentar reagir respondendo com outra ação imediata, mas deve rolar o dado novamente: se cair 3 ou menos, o narrador tem direito de aplicar o golpe fatal." },
      4: { emoji: "🟢", title: "Dano Padrão", desc: "O ataque causa dano considerável, mas não mata. O defensor deve rolar o dado novamente para ver a consequência do ferimento (seguindo a mesma regra do número 3)." },
      5: { emoji: "🔵", title: "Raspão", desc: "O ataque pega de raspão causando dano mínimo. No entanto, o personagem ainda está preso no combate e não consegue fugir." },
      6: { emoji: "🟣", title: "Fuga Perfeita", desc: "O personagem consegue esquivar perfeitamente do golpe ou encontra uma brecha e foge da batalha com sucesso." }
    }
  },
  simplificada: {
    label: "Variação Simplificada",
    intro: "Divisão por Funções: dependendo do RPG, os dados podem ter apenas duas funções diretas, sendo divididos em dois blocos de 3 números.",
    entries: {
      1: { emoji: "⚔️", title: "Dano", desc: "O personagem falha na defesa e sofre o dano do ataque." },
      2: { emoji: "⚔️", title: "Dano", desc: "O personagem falha na defesa e sofre o dano do ataque." },
      3: { emoji: "⚔️", title: "Dano", desc: "O personagem falha na defesa e sofre o dano do ataque." },
      4: { emoji: "🏃", title: "Escapou", desc: "O personagem consegue se esquivar e escapar do combate com sucesso." },
      5: { emoji: "🏃", title: "Escapou", desc: "O personagem consegue se esquivar e escapar do combate com sucesso." },
      6: { emoji: "🏃", title: "Escapou", desc: "O personagem consegue se esquivar e escapar do combate com sucesso." }
    }
  },
  execucao: {
    label: "Dado de Execução",
    intro: "Quando um personagem é realmente alcançado e existe oportunidade de execução:",
    entries: {
      1: { emoji: "🔴", title: "Ataque Devastador", desc: "O personagem não morre automaticamente apenas pelo número. O Narrador determina um dano muito alto e um ferimento compatível. Se o dano acumulado atingir 100%, ocorre a morte." },
      2: { emoji: "🟠", title: "Ataque Crítico", desc: "Grande quantidade de dano. Pode provocar um ferimento grave e deixar o personagem extremamente vulnerável. Se atingir 100%: ☠️ Morte." },
      3: { emoji: "🟡", title: "Ataque Grave", desc: "O personagem evita a execução imediata, mas sofre dano considerável e um possível ferimento." },
      4: { emoji: "🟢", title: "Escape Ferido", desc: "O personagem consegue escapar do ataque principal, mas pode sofrer uma consequência menor." },
      5: { emoji: "🔵", title: "Esquiva", desc: "O personagem evita o ataque e consegue abrir distância." },
      6: { emoji: "🟣", title: "Escape Perfeito", desc: "O personagem evita completamente aquela tentativa de execução e consegue sair da situação imediata." }
    }
  }
};

export const DEFAULT_MODE = "tabela";
