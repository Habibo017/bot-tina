require('dotenv').config();
const { Telegraf } = require('telegraf');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const supabase = require('./supabaseClient');
const FormData = require('form-data');

// Iniciar o bot
const bot = new Telegraf(process.env.TELEGRAM_TOKEN);
console.log('Tina está online...');

// Função: buscar conversation_id do usuário no Supabase
async function getConversationId(userId) {
  const { data, error } = await supabase
    .from('conversations')
    .select('conversation_id')
    .eq('user_id', userId)
    .single();
  return data?.conversation_id || null;
}

// Função: salvar conversation_id no Supabase
async function saveConversationId(userId, conversationId) {
  await supabase
    .from('conversations')
    .upsert({ user_id: userId, conversation_id: conversationId });
}

// Função principal: integrar com Dify
async function getDifyResponse(message, userId) {
  try {
    let conversationId = await getConversationId(userId);

    const response = await axios.post(
      'https://api.dify.ai/v1/chat-messages',
      {
        user: String(userId),
        query: message,
        response_mode: 'blocking',
        conversation_id: conversationId,
        inputs: {}
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.DIFY_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const newConversationId = response.data.conversation_id;
    if (newConversationId && !conversationId) {
      await saveConversationId(userId, newConversationId);
    }

    return response.data.answer;
  } catch (error) {
    console.error('Erro ao se comunicar com a Dify:', error.response?.data || error.message);
    return 'Desculpe, não consegui obter a resposta da Dify.';
  }
}

// Função para fazer o upload de uma imagem para a Dify
async function uploadFile(fileUrl, userId) {
  try {
    // Baixar a imagem para o servidor local
    const response = await axios.get(fileUrl, { responseType: 'stream' });
    const filePath = path.join(__dirname, 'temp_image.jpg');

    // Salvar a imagem no disco
    const writer = fs.createWriteStream(filePath);
    response.data.pipe(writer);

    // Esperar o download ser concluído
    return new Promise((resolve, reject) => {
      writer.on('finish', async () => {
        // Após o download, enviar o arquivo para a Dify
        const formData = new FormData();
        formData.append('file', fs.createReadStream(filePath)); // Caminho do arquivo
        formData.append('user', userId); // Identificador único do usuário

        try {
          const uploadResponse = await axios.post(
            'https://api.dify.ai/v1/files/upload',
            formData,
            {
              headers: {
                'Authorization': `Bearer ${process.env.DIFY_API_KEY}`,
                'Content-Type': 'multipart/form-data',
              },
            }
          );

          // Remover o arquivo temporário após o upload
          fs.unlinkSync(filePath);

          resolve(uploadResponse.data);
        } catch (error) {
          console.error('Erro ao fazer o upload do arquivo:', error.response?.data || error.message);
          reject(new Error('Falha ao enviar arquivo para Dify'));
        }
      });

      writer.on('error', (error) => {
        console.error('Erro ao salvar arquivo:', error);
        reject(new Error('Erro ao baixar ou salvar a imagem.'));
      });
    });
  } catch (error) {
    console.error('Erro ao baixar a imagem:', error.response?.data || error.message);
    throw new Error('Falha ao processar a imagem');
  }
}

// Monitorar mensagens de texto e imagens do Telegram
bot.on('text', async (ctx) => {
  const chatId = ctx.chat.id;
  const userName = ctx.from.first_name || 'Usuário';
  const messageText = ctx.message.text;

  // Se a mensagem for texto, processa normalmente
  if (messageText) {
    const aiResponse = await getDifyResponse(messageText, chatId);

    // Timestamp
    const now = new Date();
    const format = (v) => String(v).padStart(2, '0');
    const day = format(now.getDate());
    const month = format(now.getMonth() + 1);
    const year = now.getFullYear();
    const hour = format(now.getHours());
    const minute = format(now.getMinutes());
    const second = format(now.getSeconds());

    // Logs
    console.log('===== TINA IA =======');
    console.log(`|-> ID: ${chatId}`);
    console.log(`|-> Usuário: ${userName}`);
    console.log(`|-> Mensagem: ${messageText.length > 20 ? messageText.slice(0, 20) + '...' : messageText}`);
    console.log(`|-> Data: ${day}/${month}/${year}`);
    console.log(`|-> Hora: ${hour}:${minute}:${second}`);
    console.log(`|-> Resposta da Tina: ${aiResponse?.length > 50 ? aiResponse.slice(0, 50) + '...' : aiResponse}`);
    console.log('========================\n');

    // Enviar resposta
    ctx.reply(aiResponse || 'Desculpe, algo deu errado.');
  }
});

bot.on('photo', async (ctx) => {
  const file = ctx.message.photo[ctx.message.photo.length - 1]; // Pegando a maior versão da imagem
  const fileId = file.file_id;

  try {
    // Baixar o arquivo de imagem do Telegram
    const fileInfo = await bot.telegram.getFile(fileId);
    const fileUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_TOKEN}/${fileInfo.file_path}`;

    // Fazer o upload para Dify
    const result = await uploadFile(fileUrl, ctx.chat.id);
    ctx.reply(`Imagem recebida e carregada com sucesso! ID do arquivo: ${result.id}`);
  } catch (error) {
    ctx.reply('Desculpe, houve um erro ao processar sua imagem.');
  }
});

bot.launch();
