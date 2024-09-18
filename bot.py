import logging
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import Updater, CommandHandler, CallbackContext, MessageHandler, Filters, CallbackQueryHandler
import threading
import time
from datetime import datetime, timedelta

# Включаем логирование
logging.basicConfig(format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
                    level=logging.INFO)

logger = logging.getLogger(__name__)

# Токен вашего бота
TOKEN = 'ВАШ_ТОКЕН'

updater = Updater(TOKEN)

# Этот словарь хранит отложенные сообщения
scheduled_messages = {}


class Reminder:
    def __init__(self, message, chat_id, date_time, description=None):
        self.message = message
        self.chat_id = chat_id
        self.date_time = date_time
        self.description = description


def start(update: Update, context: CallbackContext) -> None:
    update.message.reply_text('Привет! Используйте /set_reminder, чтобы настроить напоминание.')


def set_reminder(update: Update, context: CallbackContext) -> None:
    update.message.reply_text('Какое сообщение вы хотите получить?')
    return 'GET_MESSAGE'


def get_message(update: Update, context: CallbackContext) -> None:
    context.user_data['message'] = update.message.text
    update.message.reply_text('Есть ли у этого сообщения пояснение? (напишите "нет", если пропустите)')
    return 'GET_DESCRIPTION'


def get_description(update: Update, context: CallbackContext) -> None:
    description = update.message.text if update.message.text.lower() != 'нет' else None
    context.user_data['description'] = description

    keyboard = [
        [InlineKeyboardButton("1 час", callback_data='1_hour')],
        [InlineKeyboardButton("2 часа", callback_data='2_hours')],
        [InlineKeyboardButton("3 часа", callback_data='3_hours')]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    update.message.reply_text('Когда вы хотите отправить напоминание?', reply_markup=reply_markup)
    return 'GET_TIME'


def get_time(update: Update, context: CallbackContext) -> None:
    query = update.callback_query
    query.answer()
    
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

    query.edit_message_text(text=f'Напоминание установлено! Сообщение: "{message}", отправка через {wait_time}.')
    return -1  # Завершаем разговор


def send_scheduled_messages():
    while True:
        now = datetime.now()
        for chat_id, reminder in list(scheduled_messages.items()):
            if reminder.date_time <= now:
                updater.bot.send_message(chat_id=chat_id, text=f'Напоминание: {reminder.message}')
                if reminder.description:
                    updater.bot.send_message(chat_id=chat_id, text=f'Описание: {reminder.description}')
                del scheduled_messages[chat_id]  # Удаляем сообщение после отправки
        time.sleep(60)  # Проверяем каждую минуту


def main() -> None:
    # Обработчики команд
    updater.dispatcher.add_handler(CommandHandler("start", start))
    updater.dispatcher.add_handler(CommandHandler("set_reminder", set_reminder))

    # Обработчики состояний
    updater.dispatcher.add_handler(MessageHandler(Filters.text & ~Filters.command, get_message))
    updater.dispatcher.add_handler(CallbackQueryHandler(get_time))

    # Запускаем поток для отправки запланированных сообщений
    threading.Thread(target=send_scheduled_messages, daemon=True).start()

    # Запуск бота
    updater.start_polling()
    updater.idle()


if __name__ == '__main__':
    main()
