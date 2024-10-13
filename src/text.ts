
export abstract class DialogText {
    abstract get DIALOG_ENTER(): string;
    
    abstract get DIALOG_OPTION_TODAY(): string;
    abstract get DIALOG_OPTION_TOMORROW(): string;
    abstract get DIALOG_OPTION_LATER(): string

    abstract get ENTER_DATE_QUESTION(): string

    abstract get DIALOG_DATE_ENTER_PARSE_ERROR(): string
    abstract get DIALOG_DATE_ENTER_TOO_LATE_ERROR(): string
    
    abstract get SELECT_TIME_QUESTION(): string
    
    abstract get DIALOG_OPTION_ONE_MINUTE(): string
    abstract get DIALOG_OPTION_FIVE_MINUTES(): string
    abstract get DIALOG_OPTION_HOUR(): string
    abstract get DIALOG_OPTION_IN_THE_MORNING(): string
    abstract get DIALOG_OPTION_IN_THE_AFTERNOON(): string
    abstract get DIALOG_OPTION_IN_THE_EVENING(): string
    abstract get DIALOG_OPTION_BEFORE_BAD(): string
    abstract get DIALOG_OPTION_ENTER_TIME(): string
    
    abstract get ENTER_TIME_QUESTION(): string

    abstract get DIALOG_TIME_ENTER_PARSE_ERROR(): string
    abstract get DIALOG_TIME_ENTER_TOO_LATE_ERROR(): string

    abstract get ENTER_CONTENT_QUESTION(): string

    abstract get NOTIFICATION_MESSAGE(): string

    abstract mk_CONFORMATION_TEXT(date:string): string
}

export class DialogTextRUru extends DialogText {
    get DIALOG_ENTER(): string {
        return "На когда создать уведомление?"
    }
    get DIALOG_OPTION_TODAY(): string {
        return "Сегодня"
    }
    get DIALOG_OPTION_TOMORROW(): string {
        return "Завтра"
    }
    get DIALOG_OPTION_LATER(): string {
        return "Завтра или позже"
    }
    get ENTER_DATE_QUESTION(): string {
        return "Введите дату в формате DD.MM.YYYY"
    }
    get DIALOG_DATE_ENTER_PARSE_ERROR(): string {
        return "Дата не распознана, введите другую дату"
    }
    get DIALOG_DATE_ENTER_TOO_LATE_ERROR(): string {
        return "Мы не можем напомнить вам в прошлом :( Попробуйте еще раз"
    }
    get SELECT_TIME_QUESTION(): string {
        return "Укажите время"
    }
    get DIALOG_OPTION_ONE_MINUTE(): string {
        return "Через минуту"
    }
    get DIALOG_OPTION_FIVE_MINUTES(): string {
        return "Через 5 минут"
    }
    get DIALOG_OPTION_HOUR(): string {
        return "Через час"
    }
    get DIALOG_OPTION_IN_THE_MORNING(): string {
        return "Утром (08:00)"
    }
    get DIALOG_OPTION_IN_THE_AFTERNOON(): string {
        return "Днем (12:00)"
    }
    get DIALOG_OPTION_IN_THE_EVENING(): string {
        return "Вечером (18:00)"
    }
    get DIALOG_OPTION_BEFORE_BAD(): string {
        return "На сон грядущий (23:00)"
    }
    get DIALOG_OPTION_ENTER_TIME(): string {
        return "Напишу время"
    }
    get ENTER_TIME_QUESTION(): string {
        return "Напечатайте время в формате HH:mm"
    }
    get DIALOG_TIME_ENTER_PARSE_ERROR(): string {
        return "Время не распознано, введите другое время"
    }
    get DIALOG_TIME_ENTER_TOO_LATE_ERROR(): string {
        return "Мы не можем Вам напомнить в прошлом :( Попробуйте еще раз"
    }
    get ENTER_CONTENT_QUESTION(): string {
        return "Отправьте контент напоминания"
    }
    mk_CONFORMATION_TEXT(date: string): string {
        return `Создано новое напоминание на ${date}`
    }
    get NOTIFICATION_MESSAGE(): string {
        return 'Напоминание!'
    }
}

export function text(lang:string): DialogText {
    if (lang === 'RU_ru') {
        return new DialogTextRUru()
    }
    return new DialogTextRUru()
    // throw new Error(`UNKNOWN LANGUAGE ${lang}`)
}
