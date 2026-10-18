// ============================================================
// ADAMANTINA ROLEPLAY | SISTEMA DE TICKETS
// Arquivo: index.js
// Discord.js v14
// ============================================================

const {
    Client,
    GatewayIntentBits,
    ChannelType,
    PermissionFlagsBits,
    EmbedBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    UserSelectMenuBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    REST,
    Routes,
    SlashCommandBuilder,
    MessageFlags,
    Events
} = require('discord.js');

// ============================================================
// CLIENT
// ============================================================

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

// ============================================================
// CONFIGURAÇÕES
// ============================================================

const GUILD_ID = '1553064455368347678';

const CATEGORIA_TICKETS = '💎 | Suporte Adamantina';

const CARGO_SUPORTE = '🎟️ | Perm Ticket';

const CANAL_AVALIACOES = '1553992142635143178';

const COR_PRINCIPAL = 0xC8102E;
const COR_SUCESSO = 0x2ECC71;
const COR_AVALIACAO = 0xF1C40F;

// ============================================================
// TIPOS DE TICKET
// ============================================================

const TIPOS_TICKET = {
    suporte: {
        nome: 'suporte',
        titulo: 'Suporte',
        descricao: 'Precisa de ajuda? Explique seu problema para nossa equipe.',
        emoji: '🎟️'
    },

    duvidas: {
        nome: 'duvidas',
        titulo: 'Dúvidas',
        descricao: 'Escreva sua pergunta para nossa equipe.',
        emoji: '❓'
    },

    bug: {
        nome: 'relatar-bug',
        titulo: 'Relatar Bug',
        descricao: 'Descreva o erro encontrado e como podemos reproduzi-lo.',
        emoji: '🐛'
    },

    parceria: {
        nome: 'parceria',
        titulo: 'Parceria',
        descricao: 'Apresente sua proposta de parceria.',
        emoji: '🤝'
    },

    vender: {
        nome: 'vender',
        titulo: 'Vender',
        descricao: 'Explique o assunto relacionado a vendas.',
        emoji: '💰'
    }
};

// ============================================================
// UTILITÁRIOS DE TICKET
// ============================================================

function lerTopico(canal) {
    const topico = canal.topic || '';

    const dados = {};

    for (const parte of topico.split('|')) {
        const indice = parte.indexOf(':');

        if (indice === -1) continue;

        const chave = parte.slice(0, indice);
        const valor = parte.slice(indice + 1);

        dados[chave] = valor;
    }

    return dados;
}

function criarTopico(dados) {
    return [
        'ticket-user:' + dados.user,
        'ticket-type:' + dados.type,
        'attendant:' + (dados.attendant || 'none'),
        'status:' + (dados.status || 'open')
    ].join('|');
}

async function atualizarTopico(canal, alteracoes = {}) {
    const dados = lerTopico(canal);

    const usuario = dados['ticket-user'];
    const tipo = dados['ticket-type'];

    const atendente =
        alteracoes.attendant !== undefined
            ? alteracoes.attendant
            : dados.attendant;

    const status =
        alteracoes.status !== undefined
            ? alteracoes.status
            : dados.status;

    await canal.setTopic(
        criarTopico({
            user: usuario,
            type: tipo,
            attendant: atendente,
            status: status
        })
    );

    return lerTopico(canal);
}

function ehTicket(canal) {
    if (!canal || canal.type !== ChannelType.GuildText) {
        return false;
    }

    const dados = lerTopico(canal);

    return Boolean(
        dados['ticket-user'] &&
        dados['ticket-type']
    );
}

function obterConfiguracao(canal) {
    const dados = lerTopico(canal);

    return TIPOS_TICKET[dados['ticket-type']] || {
        titulo: 'Atendimento',
        emoji: '🎟️',
        descricao: 'Atendimento da Adamantina Roleplay.'
    };
}

function criarEmbedTicket(canal, statusPersonalizado) {
    const dados = lerTopico(canal);
    const configuracao = obterConfiguracao(canal);

    const usuarioId = dados['ticket-user'];

    const atendenteId =
        dados.attendant && dados.attendant !== 'none'
            ? dados.attendant
            : null;

    const status = statusPersonalizado ||
        (dados.status === 'open'
            ? '🟡 Aguardando atendimento'
            : '🔴 Encerrado');

    const embed = new EmbedBuilder()
        .setColor(COR_PRINCIPAL)
        .setTitle(
            configuracao.emoji +
            ' ADAMANTINA ROLEPLAY | ' +
            configuracao.titulo.toUpperCase()
        )
        .setDescription(
            'Bem-vindo à central de atendimento da **Adamantina Roleplay**!\n\n' +
            configuracao.descricao +
            '\n\n' +
            'Nossa equipe atenderá você assim que possível.'
        )
        .addFields(
            {
                name: '👤 Usuário',
                value: '<@' + usuarioId + '>',
                inline: true
            },
            {
                name: '🟢 Atendente',
                value: atendenteId
                    ? '<@' + atendenteId + '>'
                    : 'Nenhum',
                inline: true
            },
            {
                name: '📌 Status',
                value: status,
                inline: false
            }
        )
        .setFooter({
            text: 'Adamantina Roleplay • Central de Atendimento'
        })
        .setTimestamp();

    return embed;
}

function criarBotoesTicket() {
    const assumir = new ButtonBuilder()
        .setCustomId('ticket_assumir')
        .setLabel('Assumir')
        .setEmoji('🟢')
        .setStyle(ButtonStyle.Success);

    const fechar = new ButtonBuilder()
        .setCustomId('ticket_fechar')
        .setLabel('Fechar')
        .setEmoji('🔒')
        .setStyle(ButtonStyle.Danger);

    const painel = new ButtonBuilder()
        .setCustomId('ticket_painel_adm')
        .setLabel('Painel ADM')
        .setEmoji('⚙️')
        .setStyle(ButtonStyle.Secondary);

    return new ActionRowBuilder().addComponents(
        assumir,
        fechar,
        painel
    );
}

function criarBotoesAvaliacao(usuarioId, atendenteId, tipo, ticketId) {
    const botoes = [];

    for (let nota = 1; nota <= 5; nota++) {
        botoes.push(
            new ButtonBuilder()
                .setCustomId(
                    'avaliar:' +
                    nota + ':' +
                    usuarioId + ':' +
                    atendenteId + ':' +
                    tipo + ':' +
                    ticketId
                )
                .setLabel(String(nota))
                .setEmoji('⭐')
                .setStyle(
                    nota <= 2
                        ? ButtonStyle.Danger
                        : nota === 3
                            ? ButtonStyle.Secondary
                            : ButtonStyle.Success
                )
        );
    }

    return new ActionRowBuilder().addComponents(botoes);
}

async function obterCargoSuporte(guild) {
    return guild.roles.cache.find(
        cargo => cargo.name === CARGO_SUPORTE
    ) || null;
}

async function membroEhEquipe(interaction) {
    const cargo = await obterCargoSuporte(interaction.guild);

    if (!cargo) return false;

    const membro = await interaction.guild.members.fetch(
        interaction.user.id
    );

    return membro.roles.cache.has(cargo.id);
}

async function membroEhAdministrador(interaction) {
    const membro = await interaction.guild.members.fetch(
        interaction.user.id
    );

    return membro.permissions.has(
        PermissionFlagsBits.Administrator
    );
}

async function podeGerenciarTicket(interaction) {
    const dados = lerTopico(interaction.channel);

    if (dados.attendant !== interaction.user.id) {
        return false;
    }

    return true;
}

// ============================================================
// COMANDO /TICKET
// ============================================================

async function registrarComando() {
    const comando = new SlashCommandBuilder()
        .setName('ticket')
        .setDescription(
            'Envia o painel de atendimento da Adamantina Roleplay'
        );

    const rest = new REST({ version: '10' })
        .setToken(process.env.DISCORD_TOKEN);

    await rest.put(
        Routes.applicationGuildCommands(
            client.user.id,
            GUILD_ID
        ),
        {
            body: [comando.toJSON()]
        }
    );

    console.log('✅ Comando /ticket registrado!');
}

// ============================================================
// BOT ONLINE
// ============================================================

client.once(Events.ClientReady, async () => {
    console.log('🤖 Bot online: ' + client.user.tag);

    try {
        await registrarComando();
    } catch (erro) {
        console.error(
            '❌ Erro ao registrar o comando:',
            erro
        );
    }
});

// ============================================================
// INTERAÇÕES
// ============================================================

client.on(Events.InteractionCreate, async interaction => {
    try {

        // ====================================================
        // COMANDO /TICKET
        // ====================================================

        if (
            interaction.isChatInputCommand() &&
            interaction.commandName === 'ticket'
        ) {
            if (
                !interaction.memberPermissions ||
                !interaction.memberPermissions.has(
                    PermissionFlagsBits.Administrator
                )
            ) {
                return interaction.reply({
                    content:
                        '❌ Apenas administradores podem enviar o painel.',
                    flags: MessageFlags.Ephemeral
                });
            }

            const embed = new EmbedBuilder()
                .setColor(COR_PRINCIPAL)
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
                    text:
                        'Adamantina Roleplay • Central de Atendimento'
                })
                .setTimestamp();

            const seletor = new StringSelectMenuBuilder()
                .setCustomId('selecionar_ticket')
                .setPlaceholder(
                    '🎫 Selecione o tipo de atendimento'
                )
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
                flags: MessageFlags.Ephemeral
            });
        }

        // ====================================================
        // CRIAR TICKET
        // ====================================================

        if (
            interaction.isStringSelectMenu() &&
            interaction.customId === 'selecionar_ticket'
        ) {
            await interaction.deferReply({
                flags: MessageFlags.Ephemeral
            });

            const guild = interaction.guild;
            const usuario = interaction.user;
            const tipo = interaction.values[0];

            const configuracao = TIPOS_TICKET[tipo];

            if (!configuracao) {
                return interaction.editReply({
                    content: '❌ Tipo de atendimento inválido.'
                });
            }

            const existente = guild.channels.cache.find(c => {
                if (!ehTicket(c)) return false;

                const dados = lerTopico(c);

                return (
                    dados['ticket-user'] === usuario.id &&
                    dados.status !== 'closed'
                );
            });

            if (existente) {
                return interaction.editReply({
                    content:
                        '⚠️ Você já possui um ticket aberto: ' +
                        existente
                });
            }

            const categoria = guild.channels.cache.find(c =>
                c.type === ChannelType.GuildCategory &&
                c.name === CATEGORIA_TICKETS
            );

            if (!categoria) {
                return interaction.editReply({
                    content:
                        '❌ Não encontrei a categoria "' +
                        CATEGORIA_TICKETS + '".'
                });
            }

            const cargo = await obterCargoSuporte(guild);

            if (!cargo) {
                return interaction.editReply({
                    content:
                        '❌ Não encontrei o cargo "' +
                        CARGO_SUPORTE + '".'
                });
            }

            const canal = await guild.channels.create({
                name: configuracao.nome,
                type: ChannelType.GuildText,
                parent: categoria.id,

                topic: criarTopico({
                    user: usuario.id,
                    type: tipo,
                    attendant: 'none',
                    status: 'open'
                }),

                permissionOverwrites: [
                    {
                        id: guild.roles.everyone.id,
                        deny: [
                            PermissionFlagsBits.ViewChannel
                        ]
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
                            PermissionFlagsBits.AttachFiles,
                            PermissionFlagsBits.EmbedLinks
                        ]
                    },
                    {
                        id: client.user.id,
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.ReadMessageHistory,
                            PermissionFlagsBits.ManageChannels,
                            PermissionFlagsBits.EmbedLinks
                        ]
                    }
                ]
            });

            const embed = criarEmbedTicket(canal);

            await canal.send({
                content:
                    usuario.toString() +
                    ' <@&' + cargo.id + '>',

                embeds: [embed],

                components: [
                    criarBotoesTicket()
                ]
            });

            return interaction.editReply({
                content:
                    '✅ Seu ticket foi aberto: ' + canal
            });
        }

        // ====================================================
        // ASSUMIR TICKET
        // ====================================================

        if (
            interaction.isButton() &&
            interaction.customId === 'ticket_assumir'
        ) {
            const canal = interaction.channel;

            if (!ehTicket(canal)) {
                return interaction.reply({
                    content: '❌ Este canal não é um ticket válido.',
                    flags: MessageFlags.Ephemeral
                });
            }

            const dados = lerTopico(canal);

            if (dados.status === 'closed') {
                return interaction.reply({
                    content: '❌ Este ticket já está encerrado.',
                    flags: MessageFlags.Ephemeral
                });
            }

            const equipe = await membroEhEquipe(interaction);
            const admin = await membroEhAdministrador(interaction);

            if (!equipe && !admin) {
                return interaction.reply({
                    content:
                        '❌ Somente a equipe de atendimento pode assumir tickets.',
                    flags: MessageFlags.Ephemeral
                });
            }

            if (
                dados.attendant &&
                dados.attendant !== 'none'
            ) {
                return interaction.reply({
                    content:
                        '⚠️ Este ticket já foi assumido por <@' +
                        dados.attendant + '>.',
                    flags: MessageFlags.Ephemeral
                });
            }

            await atualizarTopico(canal, {
                attendant: interaction.user.id
            });

            await interaction.message.edit({
                embeds: [
                    criarEmbedTicket(
                        canal,
                        '🟢 Em atendimento'
                    )
                ],
                components: [
                    criarBotoesTicket()
                ]
            });

            await canal.send({
                content:
                    '🟢 ' + interaction.user +
                    ' assumiu este atendimento!'
            });

            return interaction.reply({
                content: '✅ Você assumiu este ticket.',
                flags: MessageFlags.Ephemeral
            });
        }

        // ====================================================
        // ABRIR PAINEL ADM
        // ====================================================

        if (
            interaction.isButton() &&
            interaction.customId === 'ticket_painel_adm'
        ) {
            if (!ehTicket(interaction.channel)) {
                return interaction.reply({
                    content: '❌ Este canal não é um ticket válido.',
                    flags: MessageFlags.Ephemeral
                });
            }

            const dados = lerTopico(interaction.channel);

            if (
                !dados.attendant ||
                dados.attendant === 'none'
            ) {
                return interaction.reply({
                    content:
                        '⚠️ Primeiro, um atendente precisa assumir o ticket.',
                    flags: MessageFlags.Ephemeral
                });
            }

            if (!(await podeGerenciarTicket(interaction))) {
                return interaction.reply({
                    content:
                        '❌ Somente o atendente responsável pode usar o Painel ADM.',
                    flags: MessageFlags.Ephemeral
                });
            }

            const embed = new EmbedBuilder()
                .setColor(COR_PRINCIPAL)
                .setTitle('⚙️ PAINEL ADMINISTRATIVO')
                .setDescription(
                    'Gerencie o atendimento usando os botões abaixo.\n\n' +
                    '🔔 **Notificar usuário:** envia uma DM ao criador.\n' +
                    '✏️ **Renomear canal:** altera o nome do ticket.\n' +
                    '🔄 **Transferir:** transfere o atendimento.\n' +
                    '➕ **Adicionar:** permite incluir outro membro.'
                )
                .setFooter({
                    text: 'Acesso exclusivo ao atendente responsável'
                });

            const notificar = new ButtonBuilder()
                .setCustomId('adm_notificar')
                .setLabel('Notificar usuário')
                .setEmoji('🔔')
                .setStyle(ButtonStyle.Primary);

            const renomear = new ButtonBuilder()
                .setCustomId('adm_renomear')
                .setLabel('Renomear canal')
                .setEmoji('✏️')
                .setStyle(ButtonStyle.Secondary);

            const transferir = new ButtonBuilder()
                .setCustomId('adm_transferir')
                .setLabel('Transferir')
                .setEmoji('🔄')
                .setStyle(ButtonStyle.Primary);

            const adicionar = new ButtonBuilder()
                .setCustomId('adm_adicionar')
                .setLabel('Adicionar')
                .setEmoji('➕')
                .setStyle(ButtonStyle.Success);

            return interaction.reply({
                embeds: [embed],
                components: [
                    new ActionRowBuilder().addComponents(
                        notificar,
                        renomear
                    ),
                    new ActionRowBuilder().addComponents(
                        transferir,
                        adicionar
                    )
                ],
                flags: MessageFlags.Ephemeral
            });
        }

        // ====================================================
        // VALIDAR ACESSO AO PAINEL ADM
        // ====================================================

        if (
            interaction.isButton() &&
            [
                'adm_notificar',
                'adm_renomear',
                'adm_transferir',
                'adm_adicionar'
            ].includes(interaction.customId)
        ) {
            if (!ehTicket(interaction.channel)) {
                return interaction.reply({
                    content: '❌ Ticket inválido.',
                    flags: MessageFlags.Ephemeral
                });
            }

            if (!(await podeGerenciarTicket(interaction))) {
                return interaction.reply({
                    content:
                        '❌ Somente o atendente responsável pode utilizar esta função.',
                    flags: MessageFlags.Ephemeral
                });
            }

            const dados = lerTopico(interaction.channel);

            if (dados.status === 'closed') {
                return interaction.reply({
                    content: '❌ Este ticket está encerrado.',
                    flags: MessageFlags.Ephemeral
                });
            }

            // -----------------------------------------------
            // NOTIFICAR USUÁRIO
            // -----------------------------------------------

            if (interaction.customId === 'adm_notificar') {
                const usuarioId = dados['ticket-user'];

                try {
                    const usuario = await client.users.fetch(
                        usuarioId
                    );

                    await usuario.send({
                        embeds: [
                            new EmbedBuilder()
                                .setColor(COR_PRINCIPAL)
                                .setTitle(
                                    '🔔 ATUALIZAÇÃO DO SEU ATENDIMENTO'
                                )
                                .setDescription(
                                    'Olá! Você recebeu uma atualização no seu ticket da **Adamantina Roleplay**.\n\n' +
                                    '🎫 **Canal:** #' +
                                    interaction.channel.name +
                                    '\n\n' +
                                    'Acesse o servidor para continuar o atendimento.'
                                )
                                .setTimestamp()
                        ]
                    });

                    return interaction.reply({
                        content:
                            '✅ O usuário foi notificado por mensagem privada.',
                        flags: MessageFlags.Ephemeral
                    });
                } catch (erro) {
                    return interaction.reply({
                        content:
                            '❌ Não consegui enviar a DM. O usuário pode estar com mensagens privadas bloqueadas.',
                        flags: MessageFlags.Ephemeral
                    });
                }
            }

            // -----------------------------------------------
            // RENOMEAR CANAL
            // -----------------------------------------------

            if (interaction.customId === 'adm_renomear') {
                const modal = new ModalBuilder()
                    .setCustomId('modal_renomear')
                    .setTitle('Renomear ticket');

                const campo = new TextInputBuilder()
                    .setCustomId('novo_nome')
                    .setLabel('Novo nome do canal')
                    .setPlaceholder('Exemplo: suporte-luan')
                    .setStyle(TextInputStyle.Short)
                    .setMinLength(2)
                    .setMaxLength(90)
                    .setRequired(true);

                modal.addComponents(
                    new ActionRowBuilder().addComponents(campo)
                );

                return interaction.showModal(modal);
            }

            // -----------------------------------------------
            // TRANSFERIR
            // -----------------------------------------------

            if (interaction.customId === 'adm_transferir') {
                const cargo = await obterCargoSuporte(
                    interaction.guild
                );

                if (!cargo) {
                    return interaction.reply({
                        content: '❌ Cargo de suporte não encontrado.',
                        flags: MessageFlags.Ephemeral
                    });
                }

                await interaction.guild.members.fetch();

                const membros = interaction.guild.members.cache
                    .filter(membro =>
                        membro.roles.cache.has(cargo.id) &&
                        !membro.user.bot &&
                        membro.id !== interaction.user.id
                    )
                    .first(25);

                if (!membros || membros.length === 0) {
                    return interaction.reply({
                        content:
                            '❌ Não encontrei outros atendentes disponíveis.',
                        flags: MessageFlags.Ephemeral
                    });
                }

                const seletor = new StringSelectMenuBuilder()
                    .setCustomId('transferir_selecionar')
                    .setPlaceholder('Selecione o novo atendente')
                    .addOptions(
                        membros.map(membro => ({
                            label: membro.displayName.slice(0, 100),
                            description:
                                ('@' + membro.user.username).slice(0, 100),
                            value: membro.id
                        }))
                    );

                return interaction.reply({
                    content:
                        '🔄 Selecione o atendente que receberá este ticket:',
                    components: [
                        new ActionRowBuilder().addComponents(seletor)
                    ],
                    flags: MessageFlags.Ephemeral
                });
            }

            // -----------------------------------------------
            // ADICIONAR USUÁRIO
            // -----------------------------------------------

            if (interaction.customId === 'adm_adicionar') {
                const seletor = new UserSelectMenuBuilder()
                    .setCustomId('adicionar_selecionar')
                    .setPlaceholder('Selecione o jogador')
                    .setMinValues(1)
                    .setMaxValues(1);

                return interaction.reply({
                    content:
                        '➕ Selecione o jogador que deseja adicionar ao ticket:',
                    components: [
                        new ActionRowBuilder().addComponents(seletor)
                    ],
                    flags: MessageFlags.Ephemeral
                });
            }
        }

        // ====================================================
        // MODAL: RENOMEAR CANAL
        // ====================================================

        if (
            interaction.isModalSubmit() &&
            interaction.customId === 'modal_renomear'
        ) {
            if (!ehTicket(interaction.channel)) {
                return interaction.reply({
                    content: '❌ Ticket inválido.',
                    flags: MessageFlags.Ephemeral
                });
            }

            if (!(await podeGerenciarTicket(interaction))) {
                return interaction.reply({
                    content: '❌ Você não é o atendente responsável.',
                    flags: MessageFlags.Ephemeral
                });
            }

            let nome = interaction.fields
                .getTextInputValue('novo_nome')
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/[^a-z0-9-]/g, '-')
                .replace(/-+/g, '-')
                .replace(/^-|-$/g, '')
                .slice(0, 90);

            if (!nome) {
                return interaction.reply({
                    content: '❌ Informe um nome válido.',
                    flags: MessageFlags.Ephemeral
                });
            }

            await interaction.channel.setName(nome);

            return interaction.reply({
                content: '✅ Canal renomeado para **' + nome + '**.',
                flags: MessageFlags.Ephemeral
            });
        }

        // ====================================================
        // TRANSFERIR TICKET
        // ====================================================

        if (
            interaction.isStringSelectMenu() &&
            interaction.customId === 'transferir_selecionar'
        ) {
            if (!ehTicket(interaction.channel)) {
                return interaction.reply({
                    content: '❌ Ticket inválido.',
                    flags: MessageFlags.Ephemeral
                });
            }

            if (!(await podeGerenciarTicket(interaction))) {
                return interaction.reply({
                    content: '❌ Você não é o atendente responsável.',
                    flags: MessageFlags.Ephemeral
                });
            }

            const novoAtendenteId = interaction.values[0];

            const cargo = await obterCargoSuporte(
                interaction.guild
            );

            const novoAtendente =
                await interaction.guild.members.fetch(
                    novoAtendenteId
                ).catch(() => null);

            if (
                !cargo ||
                !novoAtendente ||
                !novoAtendente.roles.cache.has(cargo.id)
            ) {
                return interaction.reply({
                    content:
                        '❌ O membro selecionado não pertence à equipe de suporte.',
                    flags: MessageFlags.Ephemeral
                });
            }

            await atualizarTopico(interaction.channel, {
                attendant: novoAtendente.id
            });

            const mensagens = await interaction.channel.messages.fetch({
                limit: 20
            });

            const mensagemPrincipal = mensagens.find(m =>
                m.author.id === client.user.id &&
                m.components.some(linha =>
                    linha.components.some(botao =>
                        botao.customId === 'ticket_assumir'
                    )
                )
            );

            if (mensagemPrincipal) {
                await mensagemPrincipal.edit({
                    embeds: [
                        criarEmbedTicket(
                            interaction.channel,
                            '🔄 Atendimento transferido'
                        )
                    ],
                    components: [
                        criarBotoesTicket()
                    ]
                });
            }

            await interaction.channel.send({
                content:
                    '🔄 Atendimento transferido para ' +
                    novoAtendente.toString() +
                    '.'
            });

            return interaction.update({
                content:
                    '✅ Ticket transferido para ' +
                    novoAtendente.toString() + '.',
                components: []
            });
        }

        // ====================================================
        // ADICIONAR JOGADOR AO TICKET
        // ====================================================

        if (
            interaction.isUserSelectMenu() &&
            interaction.customId === 'adicionar_selecionar'
        ) {
            if (!ehTicket(interaction.channel)) {
                return interaction.reply({
                    content: '❌ Ticket inválido.',
                    flags: MessageFlags.Ephemeral
                });
            }

            if (!(await podeGerenciarTicket(interaction))) {
                return interaction.reply({
                    content: '❌ Você não é o atendente responsável.',
                    flags: MessageFlags.Ephemeral
                });
            }

            const usuarioId = interaction.values[0];

            const membro =
                await interaction.guild.members.fetch(usuarioId)
                    .catch(() => null);

            if (!membro) {
                return interaction.reply({
                    content:
                        '❌ Não consegui encontrar esse membro no servidor.',
                    flags: MessageFlags.Ephemeral
                });
            }

            const dados = lerTopico(interaction.channel);

            if (usuarioId === dados['ticket-user']) {
                return interaction.reply({
                    content:
                        '⚠️ Esse jogador já é o criador do ticket.',
                    flags: MessageFlags.Ephemeral
                });
            }

            await interaction.channel.permissionOverwrites.edit(
                usuarioId,
                {
                    ViewChannel: true,
                    SendMessages: true,
                    ReadMessageHistory: true,
                    AttachFiles: true,
                    EmbedLinks: true
                }
            );

            await interaction.channel.send({
                content:
                    '➕ ' + membro.toString() +
                    ' foi adicionado ao ticket por ' +
                    interaction.user.toString() + '.'
            });

            return interaction.update({
                content:
                    '✅ ' + membro.toString() +
                    ' agora tem acesso ao ticket.',
                components: []
            });
        }

        // ====================================================
        // FECHAR TICKET: ABRIR QUESTIONÁRIO
        // ====================================================

        if (
            interaction.isButton() &&
            interaction.customId === 'ticket_fechar'
        ) {
            const canal = interaction.channel;

            if (!ehTicket(canal)) {
                return interaction.reply({
                    content: '❌ Este canal não é um ticket válido.',
                    flags: MessageFlags.Ephemeral
                });
            }

            const dados = lerTopico(canal);

            if (dados.status === 'closed') {
                return interaction.reply({
                    content: '❌ Este ticket já está encerrado.',
                    flags: MessageFlags.Ephemeral
                });
            }

            const usuarioId = dados['ticket-user'];

            const equipe = await membroEhEquipe(interaction);
            const admin = await membroEhAdministrador(interaction);

            const criador = usuarioId === interaction.user.id;

            if (!criador && !equipe && !admin) {
                return interaction.reply({
                    content:
                        '❌ Você não tem permissão para fechar este ticket.',
                    flags: MessageFlags.Ephemeral
                });
            }

            const modal = new ModalBuilder()
                .setCustomId('modal_fechar_ticket')
                .setTitle('Encerrar atendimento');

            const campo = new TextInputBuilder()
                .setCustomId('motivo_fechamento')
                .setLabel('Motivo do fechamento')
                .setPlaceholder(
                    'Explique por que este atendimento está sendo encerrado.'
                )
                .setStyle(TextInputStyle.Paragraph)
                .setMinLength(3)
                .setMaxLength(1000)
                .setRequired(true);

            modal.addComponents(
                new ActionRowBuilder().addComponents(campo)
            );

            return interaction.showModal(modal);
        }

        // ====================================================
        // MODAL: CONFIRMAR FECHAMENTO
        // ====================================================

        if (
            interaction.isModalSubmit() &&
            interaction.customId === 'modal_fechar_ticket'
        ) {
            const canal = interaction.channel;

            if (!ehTicket(canal)) {
                return interaction.reply({
                    content: '❌ Ticket inválido.',
                    flags: MessageFlags.Ephemeral
                });
            }

            const dados = lerTopico(canal);

            if (dados.status === 'closed') {
                return interaction.reply({
                    content: '❌ Este ticket já foi encerrado.',
                    flags: MessageFlags.Ephemeral
                });
            }

            const usuarioId = dados['ticket-user'];

            const equipe = await membroEhEquipe(interaction);
            const admin = await membroEhAdministrador(interaction);

            const criador = usuarioId === interaction.user.id;

            if (!criador && !equipe && !admin) {
                return interaction.reply({
                    content:
                        '❌ Você não tem permissão para fechar este ticket.',
                    flags: MessageFlags.Ephemeral
                });
            }

            const motivo = interaction.fields
                .getTextInputValue('motivo_fechamento');

            const atendenteId =
                dados.attendant && dados.attendant !== 'none'
                    ? dados.attendant
                    : null;

            await atualizarTopico(canal, {
                status: 'closed'
            });

            const embedFechamento = new EmbedBuilder()
                .setColor(COR_PRINCIPAL)
                .setTitle('🔒 ATENDIMENTO ENCERRADO')
                .addFields(
                    {
                        name: '👤 Cliente',
                        value: '<@' + usuarioId + '>',
                        inline: true
                    },
                    {
                        name: '🟢 Atendente',
                        value: atendenteId
                            ? '<@' + atendenteId + '>'
                            : 'Nenhum atendente',
                        inline: true
                    },
                    {
                        name: '📝 Motivo do fechamento',
                        value: motivo.slice(0, 1000),
                        inline: false
                    }
                )
                .setFooter({
                    text: 'Adamantina Roleplay • Atendimento'
                })
                .setTimestamp();

            await interaction.reply({
                content:
                    '🔒 O ticket foi encerrado. O usuário receberá uma solicitação de avaliação quando houver um atendente responsável.',
                flags: MessageFlags.Ephemeral
            });

            await canal.send({
                embeds: [embedFechamento]
            });

            // -----------------------------------------------
            // ENVIAR AVALIAÇÃO POR DM
            // -----------------------------------------------

            if (atendenteId) {
                try {
                    const usuario = await client.users.fetch(
                        usuarioId
                    );

                    const configuracao = obterConfiguracao(canal);

                    await usuario.send({
                        embeds: [
                            new EmbedBuilder()
                                .setColor(COR_AVALIACAO)
                                .setTitle('⭐ AVALIE SEU ATENDIMENTO')
                                .setDescription(
                                    'Seu atendimento na **Adamantina Roleplay** foi encerrado!\n\n' +
                                    '🟢 **Atendente:** <@' +
                                    atendenteId + '>\n' +
                                    '🎫 **Categoria:** ' +
                                    configuracao.titulo + '\n\n' +
                                    'Como você avalia o atendimento recebido?\n\n' +
                                    'Clique em uma das notas abaixo. Sua avaliação será enviada ao canal de avaliações.'
                                )
                                .setTimestamp()
                        ],

                        components: [
                            criarBotoesAvaliacao(
                                usuarioId,
                                atendenteId,
                                dados['ticket-type'],
                                canal.id
                            )
                        ]
                    });
                } catch (erro) {
                    console.error(
                        '❌ Não foi possível enviar a DM de avaliação:',
                        erro.message
                    );

                    await canal.send(
                        '⚠️ Não consegui enviar a avaliação por DM. O usuário pode estar com mensagens privadas bloqueadas.'
                    ).catch(() => {});
                }
            } else {
                await canal.send(
                    '⚠️ Este ticket foi encerrado sem um atendente atribuído; por isso, não será solicitada uma avaliação.'
                ).catch(() => {});
            }

            // Mantém o canal por 15 segundos para a equipe
            // conseguir visualizar o encerramento.
            setTimeout(async () => {
                try {
                    await canal.delete(
                        'Ticket encerrado: ' + motivo
                    );
                } catch (erro) {
                    console.error(
                        '❌ Erro ao excluir ticket:',
                        erro.message
                    );
                }
            }, 15000);
        }

        // ====================================================
        // RECEBER AVALIAÇÃO
        // ====================================================

        if (
            interaction.isButton() &&
            interaction.customId.startsWith('avaliar:')
        ) {
            const partes = interaction.customId.split(':');

            const nota = Number(partes[1]);
            const usuarioId = partes[2];
            const atendenteId = partes[3];
            const tipo = partes[4];
            const ticketId = partes[5];

            if (
                !Number.isInteger(nota) ||
                nota < 1 ||
                nota > 5
            ) {
                return interaction.reply({
                    content: '❌ Nota de avaliação inválida.',
                    flags: MessageFlags.Ephemeral
                });
            }

            if (interaction.user.id !== usuarioId) {
                return interaction.reply({
                    content:
                        '❌ Somente o cliente deste atendimento pode avaliá-lo.',
                    flags: MessageFlags.Ephemeral
                });
            }

            const canalAvaliacoes =
                await client.channels.fetch(CANAL_AVALIACOES)
                    .catch(() => null);

            if (
                !canalAvaliacoes ||
                !canalAvaliacoes.isTextBased()
            ) {
                return interaction.reply({
                    content:
                        '❌ Não consegui encontrar o canal de avaliações. Avise um administrador.',
                    flags: MessageFlags.Ephemeral
                });
            }

            const configuracao = TIPOS_TICKET[tipo] || {
                titulo: 'Atendimento'
            };

            const estrelas = '⭐'.repeat(nota);
            const estrelasVazias = '☆'.repeat(5 - nota);

            const embedAvaliacao = new EmbedBuilder()
                .setColor(COR_AVALIACAO)
                .setTitle('📊 NOVA AVALIAÇÃO DE ATENDIMENTO')
                .addFields(
                    {
                        name: '👤 Cliente',
                        value: '<@' + usuarioId + '>',
                        inline: true
                    },
                    {
                        name: '🟢 Atendente',
                        value: '<@' + atendenteId + '>',
                        inline: true
                    },
                    {
                        name: '📁 Categoria',
                        value: configuracao.titulo,
                        inline: true
                    },
                    {
                        name: '⭐ Nota',
                        value:
                            estrelas + estrelasVazias +
                            ' (' + nota + '/5)',
                        inline: false
                    },
                    {
                        name: '🎫 Identificação do ticket',
                        value: ticketId,
                        inline: false
                    }
                )
                .setFooter({
                    text: 'Adamantina Roleplay • Avaliações'
                })
                .setTimestamp();

            await canalAvaliacoes.send({
                embeds: [embedAvaliacao]
            });

            // Desativa os botões para evitar nova avaliação
            // pelo mesmo formulário de DM.
            await interaction.update({
                content:
                    '✅ Obrigado! Sua avaliação de ' +
                    nota + '/5 foi registrada. Agradecemos por avaliar o atendimento da Adamantina Roleplay!',
                embeds: [],
                components: []
            });
        }

    } catch (erro) {
        console.error('❌ Erro na interação:', erro);

        const mensagem =
            '❌ Ocorreu um erro ao executar esta ação. Confira as permissões e os logs da hospedagem.';

        if (interaction.deferred) {
            await interaction.editReply({
                content: mensagem
            }).catch(() => {});
        } else if (interaction.replied) {
            await interaction.followUp({
                content: mensagem,
                flags: MessageFlags.Ephemeral
            }).catch(() => {});
        } else {
            await interaction.reply({
                content: mensagem,
                flags: MessageFlags.Ephemeral
            }).catch(() => {});
        }
    }
});

// ============================================================
// INICIAR BOT
// ============================================================

if (!process.env.DISCORD_TOKEN) {
    console.error(
        '❌ A variável DISCORD_TOKEN não foi configurada.'
    );

    process.exit(1);
}

client.login(process.env.DISCORD_TOKEN);
