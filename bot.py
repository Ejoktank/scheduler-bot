import logging
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import ApplicationBuilder, CommandHandler, ContextTypes, MessageHandler, filters, CallbackQueryHandler
import threading
import time
from datetime import datetime, timedelta

# Включаем логирование
logging.basicConfig(format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
                    level=logging.INFO)

logger = logging.getLogger(__name__)

# Токен вашего бота
TOKEN = '7480102557:AAHqayZi6LXwBVrwK6babLtOgie454WYZJg'

# Этот словарь хранит отложенные сообщения
scheduled_messages = {}


class Reminder:
    def __init__(self, message, chat_id, date_time, description=None):
        self.message = message
        self.chat_id = chat_id
        self.date_time = date_time
        self.description = description


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await update.message.reply_text('Привет! Используйте /set_reminder, чтобы настроить напоминание.')


async def set_reminder(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await update.message.reply_text('Какое сообщение вы хотите получить?')
    return 'GET_MESSAGE'


async def get_message(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    context.user_data['message'] = update.message.text
    await update.message.reply_text('Есть ли у этого сообщения пояснение? (напишите "нет", если пропустите)')
    return 'GET_DESCRIPTION'


async def get_description(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    description = update.message.text if update.message.text.lower() != 'нет' else None
    context.user_data['description'] = description

    keyboard = [
        [InlineKeyboardButton("1 час", callback_data='1_hour')],
        [InlineKeyboardButton("2 часа", callback_data='2_hours')],
        [InlineKeyboardButton("3 часа", callback_data='3_hours')]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    await update.message.reply_text('Когда вы хотите отправить напоминание?', reply_markup=reply_markup)
    return 'GET_TIME'


async def get_time(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    await query.answer()
    
    time_mapping = {
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
    return -1  # Завершаем разговор


async def send_scheduled_messages():
    while True:
        now = datetime.now()
        for chat_id, reminder in list(scheduled_messages.items()):
            if reminder.date_time <= now:
                await updater.bot.send_message(chat_id=chat_id, text=f'Напоминание: {reminder.message}')
                if reminder.description:
                    await updater.bot.send_message(chat_id=chat_id, text=f'Описание: {reminder.description}')
                del scheduled_messages[chat_id]  # Удаляем сообщение после отправки
        await asyncio.sleep(60)  # Проверяем каждую минуту


def main():
    # Создаём объект приложения
    global updater
    updater = ApplicationBuilder().token(TOKEN).build()

    # Обработчики команд
    updater.add_handler(CommandHandler("start", start))
    updater.add_handler(CommandHandler("set_reminder", set_reminder))

    # Обработчики состояний
    updater.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, get_message))
    updater.add_handler(CallbackQueryHandler(get_time))

    # Запускаем поток для отправки запланированных сообщений
    threading.Thread(target=send_scheduled_messages, daemon=True).start()

    # Запуск бота
    updater.run_polling()


if __name__ == '__main__':
    main()
