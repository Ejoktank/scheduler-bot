const TelegramBot = require('node-telegram-bot-api');

const token = '7480102557:AAHqayZi6LXwBVrwK6babLtOgie454WYZJg'; // Замените на свой токен
const bot = new TelegramBot(token, { polling: true });

const timeMapping = {
    '5_minutes': 5 * 60 * 1000,
    '15_minutes': 15 * 60 * 1000,
    '30_minutes': 30 * 60 * 1000,
    '1_hour': 60 * 60 * 1000,
    '2_hours': 2 * 60 * 60 * 1000,
    '3_hours': 3 * 60 * 60 * 1000,
};

const scheduledMessages = {}; // Хранит активные напоминания

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, 'Добро пожаловать! Чтобы установить напоминание, выберите день.', {
        reply_markup: {
            inline_keyboard: [
                [{ text: 'Сегодня', callback_data: 'today' }],
                [{ text: 'Завтра', callback_data: 'tomorrow' }],
                [{ text: 'Выбрать дату', callback_data: 'choose_date' }],
            ],
        },
    });
});

bot.on('callback_query', async (query) => {
    await bot.answerCallbackQuery(query.id);
    const chatId = query.message.chat.id;

    if (query.data === 'today') {
        bot.sendMessage(chatId, 'Через сколько поставить напоминание?', {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '5 минут', callback_data: '5_minutes' }],
                    [{ text: '15 минут', callback_data: '15_minutes' }],
                    [{ text: '30 минут', callback_data: '30_minutes' }],
                    [{ text: '1 час', callback_data: '1_hour' }],
                    [{ text: '2 часа', callback_data: '2_hours' }],
                    [{ text: '3 часа', callback_data: '3_hours' }],
                    [{ text: 'Утром', callback_data: 'morning' }],
                    [{ text: 'Днём', callback_data: 'day' }],
                    [{ text: 'Вечером', callback_data: 'evening' }],
                    [{ text: 'Перед сном', callback_data: 'before_sleep' }],
                ],
            },
        });
    } else if (query.data === 'tomorrow' || query.data === 'choose_date') {
        const message = query.data === 'choose_date' ? 'Напишите дату в формате дд:мм' : 'Выберите время для напоминания:';
        bot.sendMessage(chatId, message, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: 'Утром', callback_data: 'morning' }],
                    [{ text: 'Днём', callback_data: 'day' }],
                    [{ text: 'Вечером', callback_data: 'evening' }],
                    [{ text: 'Перед сном', callback_data: 'before_sleep' }],
                    [{ text: 'Задать время', callback_data: 'set_time' }],
                ],
            },
        });
    } else if (query.data === 'set_time') {
        bot.sendMessage(chatId, 'Напишите время в формате чч:мм');
        bot.once('message', (msg) => handleTimeSetting(msg, chatId));
    } else {
        handleTimeSelection(chatId, query.data);
    }
});

function handleTimeSetting(msg, chatId) {
    const time = msg.text.split(':');
    if (time.length === 2) {
        const hours = parseInt(time[0]);
        const minutes = parseInt(time[1]);
        if (!isNaN(hours) && !isNaN(minutes) && hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60) {
            const waitTime = new Date().setHours(hours, minutes, 0, 0) - Date.now();
            if (waitTime > 0) {
                bot.sendMessage(chatId, 'Введите текст напоминания:');
                bot.once('message', (msg) => scheduleMessage(chatId, msg.text, waitTime));
            } else {
                bot.sendMessage(chatId, 'Выберите время в будущем.');
            }
        } else {
            bot.sendMessage(chatId, 'Неверный формат времени. Попробуйте ещё раз в формате чч:мм');
        }
    } else {
        bot.sendMessage(chatId, 'Неверный формат времени. Попробуйте ещё раз в формате чч:мм');
    }
}

function handleTimeSelection(chatId, timeFrame) {
    let waitTime;
    switch (timeFrame) {
        case 'morning':
            waitTime = (8 * 60 * 60 * 1000) - Date.now(); // 8:00
            break;
        case 'day':
            waitTime = (12 * 60 * 60 * 1000) - Date.now(); // 12:00
            break;
        case 'evening':
            waitTime = (18 * 60 * 60 * 1000) - Date.now(); // 18:00
            break;
        case 'before_sleep':
            waitTime = (22 * 60 * 60 * 1000) - Date.now(); // 22:00
            break;
        default:
            waitTime = timeMapping[timeFrame];
    }

    if (waitTime > 0) {
        bot.sendMessage(chatId, 'Введите текст напоминания:');
        bot.once('message', (msg) => scheduleMessage(chatId, msg.text, waitTime));
    } else {
        bot.sendMessage(chatId, 'Выберите время в будущем.');
    }
}

function scheduleMessage(chatId, message, waitTime) {
    if (!message || message.trim() === '') {
        console.error('Ошибка: сообщение пустое. Напоминание не установлено.');
        return; // Не устанавливаем напоминание, если сообщение пустое
    }

    const timeoutId = setTimeout(() => {
        bot.sendMessage(chatId, message)
            .catch(err => console.error('Ошибка при отправке сообщения:', err));
        delete scheduledMessages[chatId]; // Удаляем сообщение из scheduledMessages
    }, waitTime);

    if (!scheduledMessages[chatId]) {
        scheduledMessages[chatId] = [];
    }
    scheduledMessages[chatId].push(timeoutId); // Сохраняем ID таймера
}
