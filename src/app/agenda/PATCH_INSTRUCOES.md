# Correção de mensagens de Reagendamento e Cancelamento

## Arquivo: src/app/agenda/page.tsx

### Reagendamento
Procure por (Ctrl+F):
```
toast.success('Reagendado com sucesso! WhatsApp enviado.')
```
Substitua por:
```
if (data?.whatsapp_sent) {
  toast.success('Reagendado com sucesso! Cliente notificado via WhatsApp.')
} else {
  toast.success('Reagendado com sucesso!')
  toast.error('Não foi possível enviar o WhatsApp. Verifique a conexão em Configurações.')
}
```

### Cancelamento
Procure por (Ctrl+F):
```
toast.success('Agendamento cancelado.')
```
Substitua por:
```
if (data?.whatsapp_sent) {
  toast.success('Agendamento cancelado. Cliente notificado via WhatsApp.')
} else {
  toast.success('Agendamento cancelado.')
  toast.error('Não foi possível enviar o WhatsApp. Verifique a conexão em Configurações.')
}
```
