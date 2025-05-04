const { Telegraf } = require('telegraf');
const axios = require('axios');
const https = require('https');
const dotenv = require('dotenv');
dotenv.config();
const TELEGRAM_TOKEN =  process.env.TELEGRAM_TOKEN;
const bot = new Telegraf(TELEGRAM_TOKEN);

const userPayment = {}; // Armazenar os dados temporários de pagamento dos usuários

// Comando /start
bot.start((ctx) => {
  ctx.reply('Bem-vindo! Como posso ajudar você hoje?');
});

// Inicia o processo de pagamento
bot.command('pagamento', (ctx) => {
  const userId = ctx.from.id;
  
  userPayment[userId] = {
    method: null,
    phone: null,
    amount: null,
  };

  const paymentOptions = [
    { text: 'Pagar com M-Pesa', callback_data: 'mpesa' },
    { text: 'Pagar com outro método', callback_data: 'outro' },
  ];

  const keyboard = {
    reply_markup: {
      inline_keyboard: paymentOptions.map(option => [option]),
    },
  };

  ctx.reply('Escolha o método de pagamento:', keyboard);
});

// Escolha do método de pagamento
bot.action('mpesa', (ctx) => {
  const userId = ctx.from.id;
  userPayment[userId].method = 'M-Pesa';

  ctx.reply('Por favor, insira seu número de telefone.');
});

bot.action('outro', (ctx) => {
  ctx.reply('Método de pagamento não disponível no momento.');
});

// Lógica para quando o usuário enviar o número de telefone
bot.on('text', (ctx) => {
  const userId = ctx.from.id;

  // Verifica se o usuário está no processo de alteração de número ou valor
  if (userPayment[userId] && userPayment[userId].phone === null) {
    userPayment[userId].phone = ctx.message.text;
    ctx.reply(`Novo número de telefone: ${userPayment[userId].phone}. Agora, escolha o valor de pagamento: 50, 150, 200, 450, 500, 1000`);
  }

  if (userPayment[userId] && userPayment[userId].amount === null) {
    const amount = ctx.message.text;
    if (['50', '150', '200', '450', '500', '1000'].includes(amount)) {
      userPayment[userId].amount = amount;

      const confirmKeyboard = {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Confirmar', callback_data: 'confirm' }],
            [{ text: 'Cancelar', callback_data: 'cancel' }],
            [{ text: 'Alterar', callback_data: 'alter' }],
          ],
        },
      };

      ctx.reply(
        `Confirma os dados abaixo?\nMétodo: ${userPayment[userId].method}\nNúmero: ${userPayment[userId].phone}\nValor: ${userPayment[userId].amount}`,
        confirmKeyboard
      );
    } else {
      ctx.reply('Valor inválido, escolha novamente entre: 50, 150, 200, 450, 500, 1000');
    }
  }
});

// Caso o pagamento seja cancelado, limpa os dados
bot.action('cancel', (ctx) => {
  const userId = ctx.from.id;
  delete userPayment[userId]; // Limpa os dados
  ctx.reply('Pagamento cancelado.');
});

// Caso o pagamento seja alterado, reseta o processo e solicita novas informações
bot.action('alter', (ctx) => {
  const userId = ctx.from.id;
  const alterOptions = [
    { text: 'Alterar número', callback_data: 'alter_number' },
    { text: 'Alterar valor', callback_data: 'alter_value' },
  ];

  const alterKeyboard = {
    reply_markup: {
      inline_keyboard: alterOptions.map(option => [option]),
    },
  };

  ctx.reply('O que você deseja alterar?', alterKeyboard);
});

// Alterar número
bot.action('alter_number', (ctx) => {
  const userId = ctx.from.id;
  ctx.reply('Por favor, insira o novo número de telefone.');
  userPayment[userId].phone = null; // Reseta o número
});

// Alterar valor
bot.action('alter_value', (ctx) => {
  const userId = ctx.from.id;
  ctx.reply('Por favor, insira o novo valor de pagamento (50, 150, 200, 450, 500, 1000).');
  userPayment[userId].amount = null; // Reseta o valor
});

// Lógica de finalização do pagamento
bot.action('confirm', async (ctx) => {
  const userId = ctx.from.id;
  const payment = userPayment[userId];

  if (payment.method === 'M-Pesa') {
    try {
      // Lógica para pagamento via M-Pesa
      const apikey = "66db1dgo1czkvqcrg55ew0gzt48s3gmz";
      const bearerToken = "CXS7hknUdqED/G3dvraat4Ty5swNkqCMzHskUz8VifPnVY7Cj9h+pcj1gUf0WyEWZzhTzvmiVfDNYXY5ilJ3YCimql+7lSGrgh5GTurBpC1Q4FGK9ftdN2AsXOXi9YkX8RzlFDycGKANR/f2ksloYlrIigInWRSc/VNsYAr7jqow2U+Ygngs3pQgE8RkYlmewgrl2J0fjo0NxUrXCMWoIVV7FcLK0IKPUNR8vg59ya4isJxzIFPZUDLKkAuOSiB8wXqy07hlTOD1wKohTkTDrYUKsOqILT4rYpG/C8PEvAWkziDvc0OABMiLcg7+cn8lw8lVGO6CnCnbFgE/493QfrbZBNh/upPP+EbwlFjxSUEm8107dxUSUnByvGnBG4s6AmI52UgW6oa6QnA7c8Gci/iHWoLaL4wWIQqTP29SYbbtLF5w3JEnTEdUwH3yhSCy3577ZuDd6OyLeKoHjR9yktA9fuIEGJffv/8NhRu02G+dDz3mIfPO4WtG1ntr/ndNCdgLWDBXaICLxlgjAu21QaiPcgFt/wTjjXGWs2dspoBkEMtuis3LdjxgA8iIRBr2RNnpnd1tZGSMS6FdUrnlJCsCQpSXrgNEuOn5LEAhU/6dmUCgClvcERAwOGnf1nHQEDfLA5qKpkrqRJOl0/Tl1JVkMnwq8OQ9iuwD4BhZeBI=";
      const payload = {
        input_TransactionReference: `T${Math.floor(Math.random() * 10000)}`,
        input_CustomerMSISDN: payment.phone,
        input_amount: payment.amount,
        input_ThirdPartyReference: '111PA2D',
        input_ServiceProviderCode: '171717',
      };

      console.log('Iniciando o pagamento..., por favor confirme a transação no seu celular');

      const response = await axios.post('https://api.sandbox.vm.co.mz:18352/ipg/v1x/c2bPayment/singleStage/', payload, {
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'developer.mpesa.vm.co.mz',
          'apiKey': apikey,
          'Authorization': `Bearer ${bearerToken}`,
        },
        httpsAgent: new https.Agent({
          rejectUnauthorized: false,
        }),
      });

      console.log('Resposta do pagamento:', response.data);
      ctx.reply('Pagamento realizado com sucesso!');
    } catch (error) {
      console.error('Erro ao realizar o pagamento:', error);
      ctx.reply('Erro ao processar o pagamento. Tente novamente.');
    }
  } else {
    ctx.reply('Método indisponível, por favor, tente outro método.');
  }

  delete userPayment[userId]; // Limpa os dados após o pagamento
});

bot.launch();

console.log('Bot online....');
