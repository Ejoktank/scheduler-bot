import logging
import threading
import asyncio
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from datetime import datetime, timedelta
from telegram.ext import ApplicationBuilder, CommandHandler, ContextTypes, MessageHandler, filters, CallbackQueryHandler, ConversationHandler
# Включаем логирование
logging.basicConfig(format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
                    level=logging.INFO)

logger = logging.getLogger(__name__)

# Токен вашего бота
TOKEN = '7480102557:AAHqayZi6LXwBVrwK6babLtOgie454WYZJg'

# Этот словарь хранит отложенные сообщения
scheduled_messages = {}

# Состояния разговора
GET_MESSAGE, GET_DESCRIPTION, GET_TIME = range(3)

class Reminder:
    def __init__(self, message, chat_id, date_time, description=None):
        self.message = message
        self.chat_id = chat_id
        self.date_time = date_time
        self.description = description

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    await update.message.reply_text('Привет! Используйте /set_reminder, чтобы настроить напоминание.')
    return -1

async def set_reminder(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    await update.message.reply_text('Какое сообщение вы хотите получить?')
    return GET_MESSAGE

async def get_message(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    context.user_data['message'] = update.message.text
    await update.message.reply_text('Есть ли у этого сообщения пояснение? (напишите "нет", если пропустите)')
    return GET_DESCRIPTION

async def get_description(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    description = update.message.text if update.message.text.lower() != 'нет' else None
    context.user_data['description'] = description

    keyboard = [
        [InlineKeyboardButton("1 минута", callback_data='1_minute')],
        [InlineKeyboardButton("1 час", callback_data='1_hour')],
        [InlineKeyboardButton("2 часа", callback_data='2_hours')],
        [InlineKeyboardButton("3 часа", callback_data='3_hours')]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    await update.message.reply_text('Когда вы хотите отправить напоминание?', reply_markup=reply_markup)
    return GET_TIME

async def get_time(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    await query.answer()
    
    time_mapping = {
        '1_minute': timedelta(minutes=1),
        '1_hour': timedelta(hours=1),
        '2_hours': timedelta(hours=2),
        '3_hours': timedelta(hours=3)
    }

    wait_time = time_mapping[query.data]
    message = context.user_data['message']
    description = context.user_data.get('description', None)
    reminder_time = datetime.now() + wait_time
    
    scheduled_messages[update.effective_chat.id] = Reminder(message, update.effective_chat.id, reminder_time, description)

    await query.edit_message_text(text=f'Напоминание установлено! Сообщение: "{message}", отправка через {wait_time}.')
    return ConversationHandler.END  # Завершаем разговор


async def send_scheduled_messages():
    while True:
        now = datetime.now()
        for chat_id, reminder in list(scheduled_messages.items()):
            if reminder.date_time <= now:
                try:
                    logger.info(f'Отправка сообщения в чат {chat_id}: {reminder.message}')
                    await updater.bot.send_message(chat_id=chat_id, text=f'Напоминание: {reminder.message}')
                    if reminder.description:
                        await updater.bot.send_message(chat_id=chat_id, text=f'Описание: {reminder.description}')
                    del scheduled_messages[chat_id]  # Удаляем сообщение после отправки
                except Exception as e:
                    logger.error(f'Ошибка отправки сообщения в чат {chat_id}: {e}')
        await asyncio.sleep(60)  # Проверяем каждую минуту

def send_scheduled_messages_thread():
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    loop.run_until_complete(send_scheduled_messages())

def main():
    global updater
    updater = ApplicationBuilder().token(TOKEN).build()

    # Определение ConversationHandler
    conv_handler = ConversationHandler(
        entry_points=[CommandHandler("set_reminder", set_reminder)],
        states={
            GET_MESSAGE: [MessageHandler(filters.TEXT & ~filters.COMMAND, get_message)],
            GET_DESCRIPTION: [MessageHandler(filters.TEXT & ~filters.COMMAND, get_description)],
            GET_TIME: [CallbackQueryHandler(get_time)]
        },
        fallbacks=[],
    )

    # Регистрация обработчиков
    updater.add_handler(CommandHandler("start", start))
    updater.add_handler(conv_handler)

    # Запускаем поток для отправки запланированных сообщений
    threading.Thread(target=send_scheduled_messages_thread, daemon=True).start()

    # Запуск бота
    updater.run_polling()

if __name__ == '__main__':
    main()
