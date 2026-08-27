// ============================================================
// REVERSE LIFE — configuração do Firebase
// ============================================================
// Para o terminal ser compartilhado de verdade entre TODAS as
// pessoas que visitarem o site (e não só entre abas do mesmo
// navegador), este projeto usa o Firestore do Firebase como
// "banco de dados" das rolagens.
//
// Passo a passo (grátis, leva ~5 minutos):
//   1. Acesse https://console.firebase.google.com
//   2. Crie um projeto novo (qualquer nome).
//   3. No menu lateral, vá em "Build > Firestore Database" e
//      clique em "Criar banco de dados" (modo de produção ou
//      teste, tanto faz para começar).
//   4. Em "Regras" (Rules) do Firestore, use algo como:
//
//        rules_version = '2';
//        service cloud.firestore {
//          match /databases/{database}/documents {
//            match /rolls/{roll} {
//              allow read: if true;
//              allow create: if true;
//              allow update, delete: if false;
//            }
//          }
//        }
//
//   5. No menu lateral, vá em "Configurações do projeto" (ícone
//      de engrenagem) > role até "Seus apps" > clique no ícone
//      "</>" para criar um app da Web.
//   6. Copie o objeto "firebaseConfig" que aparecer e cole aqui
//      embaixo, substituindo os valores de exemplo.
//
// Enquanto isso não for preenchido, o site funciona sozinho em
// modo local: as rolagens aparecem no terminal só entre abas
// abertas no mesmo navegador (via localStorage), para você já
// poder testar tudo antes de configurar o Firebase.
// ============================================================

export const firebaseConfig = {
  apiKey: "AIzaSyD0pUGODtBh7YklDKezM94uQ_1LT2UY_XU",
  authDomain: "reverse-life-20c07.firebaseapp.com",
  projectId: "reverse-life-20c07",
  storageBucket: "reverse-life-20c07.firebasestorage.app",
  messagingSenderId: "465510350469",
  appId: "1:465510350469:web:26a053f6b0b9f66c5ab3ec",
  measurementId: "G-WK38C4CW46"
};

// Nome da coleção do Firestore onde as rolagens ficam salvas.
export const ROLLS_COLLECTION = "rolls";

// Quantas rolagens ficam visíveis no terminal ao mesmo tempo.
export const FEED_LIMIT = 60;
