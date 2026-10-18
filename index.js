const {
Client,
GatewayIntentBits,
ChannelType,
PermissionFlagsBits,
EmbedBuilder,
ActionRowBuilder,
StringSelectMenuBuilder,
ButtonBuilder,
ButtonStyle,
REST,
Routes,
SlashCommandBuilder
} = require('discord.js');

const client = new Client({
intents: [GatewayIntentBits.Guilds]
});

const GUILD_ID = '1553064455368347678';
const CATEGORIA_TICKETS = '💎 | Suporte Adamantina';
const CARGO_SUPORTE = '🎟️ | Perm Ticket';

const TIPOS_TICKET = {
suporte: {
nome: '🎟️・suporte',
titulo: 'Suporte',
descricao: 'Precisa de ajuda? Explique seu problema para nossa equipe.'
},
duvidas: {
nome: '❓・duvidas',
titulo: 'Dúvidas',
descricao: 'Escreva sua pergunta para nossa equipe.'
},
bug: {
nome: '🐛・relatar-bug',
titulo: 'Relatar Bug',
descricao: 'Descreva o erro encontrado e como podemos reproduzi-lo.'
},
parceria: {
nome: '🤝・parceria',
titulo: 'Parceria',
descricao: 'Apresente sua proposta de parceria.'
},
vender: {
nome: '💰・vender',
titulo: 'Vender',
descricao: 'Explique o assunto relacionado a vendas.'
}
};

async function registrarComando() {
const comando = new SlashCommandBuilder()
.setName('ticket')
.setDescription('Envia o painel de atendimento da Adamantina Roleplay');

```
const rest = new REST({ version: '10' })
    .setToken(process.env.DISCORD_TOKEN);

await rest.put(
    Routes.applicationGuildCommands(client.user.id, GUILD_ID),
    { body: [comando.toJSON()] }
);

console.log('✅ Comando /ticket registrado!');
```

}

client.once('ready', async () => {
console.log(`🤖 Bot online: ${client.user.tag}`);

```
try {
    await registrarComando();
} catch (erro) {
    console.error('❌ Erro ao registrar o comando:', erro);
}
```

});

client.on('interactionCreate', async interaction => {
try {
if (
interaction.isChatInputCommand() &&
interaction.commandName === 'ticket'
) {
if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
return interaction.reply({
content: '❌ Apenas administradores podem enviar o painel.',
ephemeral: true
});
}

```
        const embed = new EmbedBuilder()
            .setColor(0xC8102E)
            .setTitle('🎟️ ADAMANTINA ROLEPLAY')
            .setDescription(
                '**CENTRAL DE ATENDIMENTO**\n\n' +
                'Bem-vindo à central oficial de atendimento da **Adamantina Roleplay**!\n\n' +
                '🎟️ **Suporte** — Precisa de ajuda?\n' +
                '❓ **Dúvidas** — Tem alguma pergunta?\n' +
                '🐛 **Relatar Bug** — Encontrou algum erro?\n' +
                '🤝 **Parceria** — Deseja propor uma parceria?\n' +
                '💰 **Vender** — Assuntos relacionados a vendas.\n\n' +
                '🔒 Seu atendimento será privado.\n\n' +
                '👇 **Selecione uma opção abaixo para começar!**'
            )
            .setFooter({
                text: 'Adamantina Roleplay • Central de Atendimento'
            })
            .setTimestamp();

        const seletor = new StringSelectMenuBuilder()
            .setCustomId('selecionar_ticket')
            .setPlaceholder('🎫 Selecione o tipo de atendimento')
            .addOptions(
                {
                    label: 'Suporte',
                    value: 'suporte',
                    emoji: '🎟️',
                    description: 'Preciso de ajuda'
                },
                {
                    label: 'Dúvidas',
                    value: 'duvidas',
                    emoji: '❓',
                    description: 'Tenho uma pergunta'
                },
                {
                    label: 'Relatar Bug',
                    value: 'bug',
                    emoji: '🐛',
                    description: 'Encontrei um erro'
                },
                {
                    label: 'Parceria',
                    value: 'parceria',
                    emoji: '🤝',
                    description: 'Quero propor uma parceria'
                },
                {
                    label: 'Vender',
                    value: 'vender',
                    emoji: '💰',
                    description: 'Assunto relacionado a vendas'
                }
            );

        await interaction.channel.send({
            embeds: [embed],
            components: [
                new ActionRowBuilder().addComponents(seletor)
            ]
        });

        return interaction.reply({
            content: '✅ Painel enviado com sucesso!',
            ephemeral: true
        });
    }

    if (
        interaction.isStringSelectMenu() &&
        interaction.customId === 'selecionar_ticket'
    ) {
        await interaction.deferReply({ ephemeral: true });

        const guild = interaction.guild;
        const usuario = interaction.user;
        const tipo = interaction.values[0];
        const configuracao = TIPOS_TICKET[tipo];

        if (!configuracao) {
            return interaction.editReply({
                content: '❌ Tipo de atendimento inválido.'
            });
        }

        const existente = guild.channels.cache.find(c =>
            c.type === ChannelType.GuildText &&
            c.topic === `ticket-user:${usuario.id}`
        );

        if (existente) {
            return interaction.editReply({
                content: `⚠️ Você já possui um ticket aberto: ${existente}`
            });
        }

        const categoria = guild.channels.cache.find(c =>
            c.type === ChannelType.GuildCategory &&
            c.name === CATEGORIA_TICKETS
        );

        if (!categoria) {
            return interaction.editReply({
                content: `❌ Não encontrei a categoria "${CATEGORIA_TICKETS}".`
            });
        }

        const cargo = guild.roles.cache.find(r =>
            r.name === CARGO_SUPORTE
        );

        if (!cargo) {
            return interaction.editReply({
                content: `❌ Não encontrei o cargo "${CARGO_SUPORTE}".`
            });
        }

        const canal = await guild.channels.create({
            name: configuracao.nome,
            type: ChannelType.GuildText,
            parent: categoria.id,
            topic: `ticket-user:${usuario.id}`,
            permissionOverwrites: [
                {
                    id: guild.roles.everyone.id,
                    deny: [PermissionFlagsBits.ViewChannel]
                },
                {
                    id: usuario.id,
                    allow: [
                        PermissionFlagsBits.ViewChannel,
                        PermissionFlagsBits.SendMessages,
                        PermissionFlagsBits.ReadMessageHistory,
                        PermissionFlagsBits.AttachFiles,
                        PermissionFlagsBits.EmbedLinks
                    ]
                },
                {
                    id: cargo.id,
                    allow: [
                        PermissionFlagsBits.ViewChannel,
                        PermissionFlagsBits.SendMessages,
                        PermissionFlagsBits.ReadMessageHistory,
                        PermissionFlagsBits.AttachFiles
                    ]
                },
                {
                    id: client.user.id,
                    allow: [
                        PermissionFlagsBits.ViewChannel,
                        PermissionFlagsBits.SendMessages,
                        PermissionFlagsBits.ReadMessageHistory,
                        PermissionFlagsBits.ManageChannels
                    ]
                }
            ]
        });

        const embedTicket = new EmbedBuilder()
            .setColor(0xC8102E)
            .setTitle(`🎟️ Atendimento: ${configuracao.titulo}`)
            .setDescription(
                `Olá, ${usuario}!\n\n` +
                `${configuracao.descricao}\n\n` +
                'Nossa equipe responderá assim que possível.\n\n' +
                '🔒 Este canal é privado. Quando terminar, clique no botão abaixo.'
            )
            .setFooter({
                text: 'Adamantina Roleplay • Suporte'
            })
            .setTimestamp();

        const fechar = new ButtonBuilder()
            .setCustomId('fechar_ticket')
            .setLabel('Fechar Ticket')
            .setEmoji('🔒')
            .setStyle(ButtonStyle.Danger);

        await canal.send({
            content: `${usuario} <@&${cargo.id}>`,
            embeds: [embedTicket],
            components: [
                new ActionRowBuilder().addComponents(fechar)
            ]
        });

        return interaction.editReply({
            content: `✅ Seu ticket foi aberto: ${canal}`
        });
    }

    if (
        interaction.isButton() &&
        interaction.customId === 'fechar_ticket'
    ) {
        const canal = interaction.channel;
        const usuario = interaction.user;
        const guild = interaction.guild;

        if (!canal.topic || !canal.topic.startsWith('ticket-user:')) {
            return interaction.reply({
                content: '❌ Este canal não foi reconhecido como ticket.',
                ephemeral: true
            });
        }

        const cargo = guild.roles.cache.find(r =>
            r.name === CARGO_SUPORTE
        );

        const membro = await guild.members.fetch(usuario.id);
        const criador = canal.topic === `ticket-user:${usuario.id}`;
        const suporte = cargo && membro.roles.cache.has(cargo.id);
        const admin = membro.permissions.has(
            PermissionFlagsBits.Administrator
        );

        if (!criador && !suporte && !admin) {
            return interaction.reply({
                content: '❌ Você não tem permissão para fechar este ticket.',
                ephemeral: true
            });
        }

        await interaction.reply({
            content: '🔒 Ticket encerrado. O canal será excluído em 5 segundos.'
        });

        setTimeout(async () => {
            try {
                await canal.delete('Ticket encerrado');
            } catch (erro) {
                console.error('❌ Erro ao excluir ticket:', erro);
            }
        }, 5000);
    }
} catch (erro) {
    console.error('❌ Erro na interação:', erro);

    const mensagem = '❌ Ocorreu um erro. Confira as permissões e os logs da hospedagem.';

    if (interaction.deferred) {
        await interaction.editReply({ content: mensagem }).catch(() => {});
    } else if (interaction.replied) {
        await interaction.followUp({
            content: mensagem,
            ephemeral: true
        }).catch(() => {});
    } else {
        await interaction.reply({
            content: mensagem,
            ephemeral: true
        }).catch(() => {});
    }
}
```

});

if (!process.env.DISCORD_TOKEN) {
console.error('❌ A variável DISCORD_TOKEN não foi configurada.');
process.exit(1);
}

client.login(process.env.DISCORD_TOKEN);
