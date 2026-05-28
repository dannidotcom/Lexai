import smtplib
from email.message import EmailMessage

from app.core.config import settings
from app.core.logging import logger


class EmailService:
    async def send_email(self, *, to: str, subject: str, body: str) -> None:
        if not settings.smtp_host:
            logger.warning("SMTP not configured; email skipped", to=to, subject=subject)
            return

        message = EmailMessage()
        message["From"] = settings.smtp_from
        message["To"] = to
        message["Subject"] = subject
        message.set_content(body)

        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as smtp:
            smtp.starttls()
            if settings.smtp_user:
                smtp.login(settings.smtp_user, settings.smtp_password)
            smtp.send_message(message)

    async def send_verification_email(self, *, email: str, token: str) -> None:
        link = f"{settings.frontend_url}/verify-email?token={token}"
        await self.send_email(
            to=email,
            subject="Verify your email",
            body=f"Verify your account using this link: {link}",
        )

    async def send_password_reset_email(self, *, email: str, token: str) -> None:
        link = f"{settings.frontend_url}/reset-password?token={token}"
        await self.send_email(
            to=email,
            subject="Reset your password",
            body=f"Reset your password using this link: {link}",
        )


email_service = EmailService()


__all__ = ["EmailService", "email_service"]
