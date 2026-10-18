//============================================================
// ADAMANTINA ROLEPLAY | SISTEMA DE TICKETS
// Arquivo: index.js
// Discord.js v14
//============================================================

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
    Events,
    MessageFlags
} = require("discord.js");

//============================================================
// CONFIGURAÇÕES
//============================================================

const TOKEN = process.env.DISCORD_TOKEN;

const GUILD_ID = "1553064455368347678";

const CATEGORIA_TICKETS = "💎 | Suporte Adamantina";

const CARGO_SUPORTE = "🎟️ | Perm Ticket";

const CANAL_AVALIACOES = "1553992142635143178";

const TEMPO_EXCLUSAO = 15000;

//============================================================
// CLIENT
//============================================================

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers
    ]
});

// Evita avaliações duplicadas durante a execução.
// Esta lista é reiniciada quando o bot reinicia.
const avaliacoesRegistradas = new Set();

//============================================================
// RESPOSTA PRIVADA
//============================================================

async function responderPrivado(interaction, conteudo) {
    const opcoes = {
        content: conteudo,
        flags: MessageFlags.Ephemeral
    };

    if (interaction.replied || interaction.deferred) {
        return interaction.followUp(opcoes);
    }

    return interaction.reply(opcoes);
}

//============================================================
// PERMISSÕES
//============================================================

function temCargoNaInteracao(interaction, cargoId) {
    if (!interaction.member || !cargoId) {
        return false;
    }

    const roles = interaction.member.roles;

    if (Array.isArray(roles)) {
        return roles.includes(cargoId);
    }

    if (roles?.cache) {
        return roles.cache.has(cargoId);
    }

    return false;
}

function ehAdministrador(interaction) {
    return Boolean(
        interaction.memberPermissions?.has(
            PermissionFlagsBits.Administrator
        )
    );
}

function obterCargoSuporte(guild) {
    return guild.roles.cache.find(
        role => role.name === CARGO_SUPORTE
    ) || null;
}

function ehEquipe(interaction) {
    if (ehAdministrador(interaction)) {
        return true;
    }

    const cargo = obterCargoSuporte(interaction.guild);

    if (!cargo) {
        return false;
    }

    return temCargoNaInteracao(interaction, cargo.id);
}

//============================================================
// METADADOS DOS TICKETS
//============================================================

function criarTopico(usuarioId, tipo, atendenteId, status) {
    return [
        `ticket-user:${usuarioId}`,
        `ticket-type:${tipo}`,
        `attendant:${atendenteId || "none"}`,
        `status:${status}`
    ].join("|");
}

function lerTopico(canal) {
    const resultado = {
        usuarioId: null,
        tipo: null,
        atendenteId: null,
        status: "open"
    };

    if (!canal?.topic) {
        return resultado;
    }

    for (const parte of canal.topic.split("|")) {
        const separador = parte.indexOf(":");

        if (separador === -1) {
            continue;
        }

        const chave = parte.slice(0, separador);
        const valor = parte.slice(separador + 1);

        if (chave === "ticket-user") {
            resultado.usuarioId = valor;
        }

        if (chave === "ticket-type") {
            resultado.tipo = valor;
        }

        if (chave === "attendant") {
            resultado.atendenteId =
                valor === "none" ? null : valor;
        }

        if (chave === "status") {
            resultado.status = valor;
        }
    }

    return resultado;
}

async function atualizarTopico(canal, dados) {
    const atuais = lerTopico(canal);

    await canal.setTopic(
        criarTopico(
            dados.usuarioId ?? atuais.usuarioId,
            dados.tipo ?? atuais.tipo,
            dados.atendenteId !== undefined
                ? dados.atendenteId
                : atuais.atendenteId,
            dados.status ?? atuais.status
        )
    );
}

function ehTicket(canal) {
    const dados = lerTopico(canal);

    return Boolean(
        dados.usuarioId &&
        dados.tipo
    );
}

//============================================================
// EMBED PRINCIPAL DO TICKET
//============================================================

function criarEmbedTicket(canal) {
    const dados = lerTopico(canal);

    const atendente = dados.atendenteId
        ? `<@${dados.atendenteId}>`
        : "Ninguém assumiu ainda.";

    const fechado = dados.status === "closed";

    return new EmbedBuilder()
        .setColor(fechado ? 0x808080 : 0xD90429)
        .setTitle("🎟️ Adamantina Roleplay | Ticket")
        .setDescription(
            "Bem-vindo ao atendimento do **Adamantina Roleplay**!\n\n" +
            "Nossa equipe está aqui para ajudar. " +
            "Explique sua situação e aguarde um membro da equipe.\n\n" +
            "━━━━━━━━━━━━━━━━━━━━━━"
        )
        .addFields(
            {
                name: "👤 Criador",
                value: dados.usuarioId
                    ? `<@${dados.usuarioId}>`
                    : "Não identificado",
                inline: true
            },
            {
                name: "🎫 Categoria",
                value: dados.tipo || "Não identificada",
                inline: true
            },
            {
                name: "🛠️ Atendente",
                value: atendente,
                inline: false
            },
            {
                name: "📊 Status",
                value: fechado
                    ? "🔴 Fechado"
                    : "🟢 Aberto",
                inline: true
            }
        )
        .setFooter({
            text: "Adamantina Roleplay • Central de Atendimento"
        })
        .setTimestamp();
}

//============================================================
// BOTÕES DO TICKET
//============================================================

function criarBotoesTicket(fechado = false) {
    if (fechado) {
        return [];
    }

    return [
        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("ticket_assumir")
                .setLabel("Assumir")
                .setEmoji("🙋")
                .setStyle(ButtonStyle.Success),

            new ButtonBuilder()
                .setCustomId("ticket_fechar")
                .setLabel("Fechar")
                .setEmoji("🔒")
                .setStyle(ButtonStyle.Danger),

            new ButtonBuilder()
                .setCustomId("ticket_painel_adm")
                .setLabel("Painel ADM")
                .setEmoji("⚙️")
                .setStyle(ButtonStyle.Secondary)
        )
    ];
}

//============================================================
// PAINEL ADMINISTRATIVO
//============================================================

function criarPainelAdm() {
    const embed = new EmbedBuilder()
        .setColor(0xD90429)
        .setTitle("⚙️ Painel Administrativo")
        .setDescription(
            "Gerencie este atendimento utilizando as opções abaixo."
        )
        .addFields(
            {
                name: "🔔 Notificar",
                value: "Enviar uma mensagem privada ao criador.",
                inline: false
            },
            {
                name: "✏️ Renomear",
                value: "Alterar o nome do canal.",
                inline: false
            },
            {
                name: "🔄 Transferir",
                value: "Transferir para outro atendente.",
                inline: false
            },
            {
                name: "➕ Adicionar jogador",
                value: "Permitir que outro jogador veja o ticket.",
                inline: false
            }
        );

    const linha = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("adm_notificar")
            .setLabel("Notificar")
            .setEmoji("🔔")
            .setStyle(ButtonStyle.Primary),

        new ButtonBuilder()
            .setCustomId("adm_renomear")
            .setLabel("Renomear")
            .setEmoji("✏️")
            .setStyle(ButtonStyle.Secondary),

        new ButtonBuilder()
            .setCustomId("adm_transferir")
            .setLabel("Transferir")
            .setEmoji("🔄")
            .setStyle(ButtonStyle.Secondary),

        new ButtonBuilder()
            .setCustomId("adm_adicionar")
            .setLabel("Adicionar")
            .setEmoji("➕")
            .setStyle(ButtonStyle.Success)
    );

    return {
        embeds: [embed],
        components: [linha],
        flags: MessageFlags.Ephemeral
    };
}

//============================================================
// ATENDENTE RESPONSÁVEL
//============================================================

function ehAtendenteResponsavel(interaction) {
    const dados = lerTopico(interaction.channel);

    return Boolean(
        dados.atendenteId &&
        dados.atendenteId === interaction.user.id
    );
}

//============================================================
// ATUALIZAR EMBED PRINCIPAL
//============================================================

async function atualizarMensagemPrincipal(canal) {
    const mensagens = await canal.messages.fetch({
        limit: 100
    });

    const mensagemPrincipal = mensagens.find(
        mensagem =>
            mensagem.author.id === client.user.id &&
            mensagem.embeds.some(
                embed =>
                    embed.title ===
                    "🎟️ Adamantina Roleplay | Ticket"
            )
    );

    if (mensagemPrincipal) {
        await mensagemPrincipal.edit({
            embeds: [criarEmbedTicket(canal)],
            components: criarBotoesTicket(
                lerTopico(canal).status === "closed"
            )
        });
    }
}

//============================================================
// COMANDO /TICKET
//============================================================

const comandoTicket = new SlashCommandBuilder()
    .setName("ticket")
    .setDescription("Enviar o painel de atendimento.")
    .setDefaultMemberPermissions(
        PermissionFlagsBits.Administrator
    );

//============================================================
// INICIALIZAÇÃO
//============================================================

client.once(Events.ClientReady, async () => {
    console.log(`🤖 Bot online: ${client.user.tag}`);

    try {
        const rest = new REST({
            version: "10"
        }).setToken(TOKEN);

        await rest.put(
            Routes.applicationGuildCommands(
                client.user.id,
                GUILD_ID
            ),
            {
                body: [comandoTicket.toJSON()]
            }
        );

        console.log("✅ Comando /ticket registrado!");
    } catch (erro) {
        console.error(
            "❌ Erro ao registrar /ticket:",
            erro
        );
    }
});

//============================================================
// INTERAÇÕES
//============================================================

client.on(Events.InteractionCreate, async interaction => {
    try {

        //====================================================
        // COMANDO /TICKET
        //====================================================

        if (interaction.isChatInputCommand()) {
            if (interaction.commandName !== "ticket") {
                return;
            }

            if (!ehAdministrador(interaction)) {
                return responderPrivado(
                    interaction,
                    "❌ Somente administradores podem enviar o painel."
                );
            }

            const menu = new StringSelectMenuBuilder()
                .setCustomId("ticket_tipo")
                .setPlaceholder("🎫 Selecione a categoria desejada")
                .addOptions(
                    {
                        label: "Suporte",
                        description: "Preciso de ajuda.",
                        value: "Suporte",
                        emoji: "🛠️"
                    },
                    {
                        label: "Dúvidas",
                        description: "Tenho uma dúvida.",
                        value: "Dúvidas",
                        emoji: "❓"
                    },
                    {
                        label: "Relatar Bug",
                        description: "Reportar um problema.",
                        value: "Relatar Bug",
                        emoji: "🐛"
                    },
                    {
                        label: "Parceria",
                        description: "Propostas de parceria.",
                        value: "Parceria",
                        emoji: "🤝"
                    },
                    {
                        label: "Vender",
                        description: "Assuntos relacionados a vendas.",
                        value: "Vender",
                        emoji: "💰"
                    }
                );

            // NOVO PAINEL MAIOR

            const embed = new EmbedBuilder()
                .setColor(0xD90429)
                .setTitle("🎟️ CENTRAL DE ATENDIMENTO")
                .setDescription(
                    "# 💎 ADAMANTINA ROLEPLAY\n\n" +
                    "Seja muito bem-vindo(a) à Central de Atendimento " +
                    "do **Adamantina Roleplay**!\n\n" +
                    "Precisa de ajuda? Nossa equipe está pronta para " +
                    "auxiliar você. Selecione abaixo a categoria que " +
                    "melhor representa sua necessidade para abrir " +
                    "um ticket privado.\n\n" +
                    "━━━━━━━━━━━━━━━━━━━━━━\n\n" +
                    "### 📌 CATEGORIAS DE ATENDIMENTO\n\n" +
                    "🛠️ **Suporte**\n" +
                    "Problemas e solicitações de ajuda.\n\n" +
                    "❓ **Dúvidas**\n" +
                    "Esclareça suas dúvidas sobre o servidor.\n\n" +
                    "🐛 **Relatar Bug**\n" +
                    "Informe erros encontrados no jogo.\n\n" +
                    "🤝 **Parceria**\n" +
                    "Apresente sua proposta de parceria.\n\n" +
                    "💰 **Vender**\n" +
                    "Assuntos relacionados a vendas.\n\n" +
                    "━━━━━━━━━━━━━━━━━━━━━━\n\n" +
                    "### 📋 ORIENTAÇÕES IMPORTANTES\n\n" +
                    "• Escolha a categoria correta.\n" +
                    "• Explique sua situação com clareza e detalhes.\n" +
                    "• Aguarde a resposta da nossa equipe.\n" +
                    "• Evite abrir vários tickets para o mesmo assunto.\n\n" +
                    "💎 **Adamantina Roleplay**\n" +
                    "*Nosso compromisso é proporcionar a melhor " +
                    "experiência possível para todos os jogadores.*"
                )
                .setFooter({
                    text: "Adamantina Roleplay • Central Oficial de Atendimento"
                })
                .setTimestamp();

            await interaction.reply({
                embeds: [embed],
                components: [
                    new ActionRowBuilder().addComponents(menu)
                ]
            });

            return;
        }

        //====================================================
        // SELEÇÃO DA CATEGORIA
        //====================================================

        if (
            interaction.isStringSelectMenu() &&
            interaction.customId === "ticket_tipo"
        ) {
            await interaction.deferReply({
                flags: MessageFlags.Ephemeral
            });

            const guild = interaction.guild;
            const tipo = interaction.values[0];

            const categoria = guild.channels.cache.find(
                canal =>
                    canal.type === ChannelType.GuildCategory &&
                    canal.name === CATEGORIA_TICKETS
            );

            if (!categoria) {
                return interaction.editReply(
                    `❌ Não encontrei a categoria **${CATEGORIA_TICKETS}**.`
                );
            }

            const cargoSuporte = obterCargoSuporte(guild);

            if (!cargoSuporte) {
                return interaction.editReply(
                    `❌ Não encontrei o cargo **${CARGO_SUPORTE}**.`
                );
            }

            const ticketExistente = guild.channels.cache.find(
                canal => {
                    if (!ehTicket(canal)) {
                        return false;
                    }

                    const dados = lerTopico(canal);

                    return (
                        dados.usuarioId === interaction.user.id &&
                        dados.status === "open"
                    );
                }
            );

            if (ticketExistente) {
                return interaction.editReply(
                    `❌ Você já possui um ticket aberto: ${ticketExistente}`
                );
            }

            const nomeUsuario = interaction.user.username
                .toLowerCase()
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .replace(/[^a-z0-9-]/g, "-")
                .replace(/-+/g, "-")
                .replace(/^-|-$/g, "")
                .slice(0, 40) || "usuario";

            const canal = await guild.channels.create({
                name: `ticket-${nomeUsuario}`.slice(0, 90),
                type: ChannelType.GuildText,
                parent: categoria.id,

                topic: criarTopico(
                    interaction.user.id,
                    tipo,
                    null,
                    "open"
                ),

                permissionOverwrites: [
                    {
                        id: guild.roles.everyone.id,
                        deny: [
                            PermissionFlagsBits.ViewChannel
                        ]
                    },
                    {
                        id: client.user.id,
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.ReadMessageHistory,
                            PermissionFlagsBits.EmbedLinks,
                            PermissionFlagsBits.AttachFiles,
                            PermissionFlagsBits.ManageChannels
                        ]
                    },
                    {
                        id: interaction.user.id,
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.ReadMessageHistory,
                            PermissionFlagsBits.AttachFiles,
                            PermissionFlagsBits.EmbedLinks
                        ]
                    },
                    {
                        id: cargoSuporte.id,
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.ReadMessageHistory,
                            PermissionFlagsBits.AttachFiles,
                            PermissionFlagsBits.EmbedLinks
                        ]
                    }
                ]
            });

            try {
                await canal.send({
                    content:
                        `${interaction.user} <@&${cargoSuporte.id}>`,
                    embeds: [criarEmbedTicket(canal)],
                    components: criarBotoesTicket()
                });
            } catch (erro) {
                await canal.delete().catch(() => {});

                throw erro;
            }

            await interaction.editReply(
                `✅ Seu ticket foi criado: ${canal}`
            );

            return;
        }

        //====================================================
        // ASSUMIR TICKET
        //====================================================

        if (
            interaction.isButton() &&
            interaction.customId === "ticket_assumir"
        ) {
            const canal = interaction.channel;

            if (!ehTicket(canal)) {
                return responderPrivado(
                    interaction,
                    "❌ Este canal não é um ticket válido."
                );
            }

            if (!ehEquipe(interaction)) {
                return responderPrivado(
                    interaction,
                    "❌ Você não tem permissão para assumir tickets."
                );
            }

            const dados = lerTopico(canal);

            if (dados.status === "closed") {
                return responderPrivado(
                    interaction,
                    "❌ Este ticket já está fechado."
                );
            }

            if (dados.atendenteId) {
                return responderPrivado(
                    interaction,
                    `❌ Este ticket já foi assumido por <@${dados.atendenteId}>.`
                );
            }

            await atualizarTopico(canal, {
                atendenteId: interaction.user.id
            });

            await interaction.update({
                embeds: [criarEmbedTicket(canal)],
                components: criarBotoesTicket()
            });

            await canal.send({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0x2ECC71)
                        .setDescription(
                            `🙋 ${interaction.user} assumiu este ticket.`
                        )
                        .setTimestamp()
                ]
            });

            return;
        }

        //====================================================
        // PAINEL ADM
        //====================================================

        if (
            interaction.isButton() &&
            interaction.customId === "ticket_painel_adm"
        ) {
            if (!ehTicket(interaction.channel)) {
                return responderPrivado(
                    interaction,
                    "❌ Este canal não é um ticket válido."
                );
            }

            const dados = lerTopico(interaction.channel);

            if (dados.status === "closed") {
                return responderPrivado(
                    interaction,
                    "❌ Este ticket já está fechado."
                );
            }

            if (!ehAtendenteResponsavel(interaction)) {
                return responderPrivado(
                    interaction,
                    "❌ Somente o atendente responsável pode utilizar o Painel ADM."
                );
            }

            await interaction.reply(criarPainelAdm());

            return;
        }

        //====================================================
        // NOTIFICAR CRIADOR
        //====================================================

        if (
            interaction.isButton() &&
            interaction.customId === "adm_notificar"
        ) {
            if (!ehAtendenteResponsavel(interaction)) {
                return responderPrivado(
                    interaction,
                    "❌ Somente o atendente responsável pode usar esta opção."
                );
            }

            const dados = lerTopico(interaction.channel);

            try {
                const usuario = await client.users.fetch(
                    dados.usuarioId
                );

                await usuario.send({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0xD90429)
                            .setTitle("🔔 Atualização do seu atendimento")
                            .setDescription(
                                "A equipe do Adamantina Roleplay " +
                                "tem uma atualização sobre seu ticket."
                            )
                            .addFields({
                                name: "🎫 Ticket",
                                value: interaction.channel.name
                            })
                            .setTimestamp()
                    ]
                });

                return responderPrivado(
                    interaction,
                    "✅ Notificação enviada ao criador por DM."
                );
            } catch (erro) {
                return responderPrivado(
                    interaction,
                    "❌ Não consegui enviar a DM. O usuário pode estar com as mensagens privadas bloqueadas."
                );
            }
        }

        //====================================================
        // RENOMEAR TICKET: ABRIR MODAL
        //====================================================

        if (
            interaction.isButton() &&
            interaction.customId === "adm_renomear"
        ) {
            if (!ehAtendenteResponsavel(interaction)) {
                return responderPrivado(
                    interaction,
                    "❌ Somente o atendente responsável pode renomear o ticket."
                );
            }

            const modal = new ModalBuilder()
                .setCustomId("adm_renomear_modal")
                .setTitle("Renomear ticket");

            const campo = new TextInputBuilder()
                .setCustomId("novo_nome")
                .setLabel("Novo nome do canal")
                .setPlaceholder("Exemplo: ticket-ajuda")
                .setStyle(TextInputStyle.Short)
                .setMinLength(1)
                .setMaxLength(90)
                .setRequired(true);

            modal.addComponents(
                new ActionRowBuilder().addComponents(campo)
            );

            await interaction.showModal(modal);

            return;
        }

        //====================================================
        // RENOMEAR TICKET: SALVAR
        //====================================================

        if (
            interaction.isModalSubmit() &&
            interaction.customId === "adm_renomear_modal"
        ) {
            if (!ehAtendenteResponsavel(interaction)) {
                return responderPrivado(
                    interaction,
                    "❌ Somente o atendente responsável pode renomear o ticket."
                );
            }

            const nomeInformado =
                interaction.fields.getTextInputValue("novo_nome");

            const novoNome = nomeInformado
                .toLowerCase()
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .replace(/[^a-z0-9-]/g, "-")
                .replace(/-+/g, "-")
                .replace(/^-|-$/g, "")
                .slice(0, 90);

            if (!novoNome) {
                return responderPrivado(
                    interaction,
                    "❌ Informe um nome válido para o canal."
                );
            }

            await interaction.channel.setName(novoNome);

            return responderPrivado(
                interaction,
                `✅ Ticket renomeado para **${novoNome}**.`
            );
        }

        //====================================================
        // TRANSFERIR TICKET: ABRIR SELETOR
        //====================================================

        if (
            interaction.isButton() &&
            interaction.customId === "adm_transferir"
        ) {
            if (!ehAtendenteResponsavel(interaction)) {
                return responderPrivado(
                    interaction,
                    "❌ Somente o atendente responsável pode transferir o ticket."
                );
            }

            const seletor = new UserSelectMenuBuilder()
                .setCustomId("transferir_selecionar")
                .setPlaceholder("Selecione o novo atendente")
                .setMinValues(1)
                .setMaxValues(1);

            await interaction.reply({
                content:
                    "🔄 Selecione o membro que receberá este ticket.\n" +
                    "O jogador precisa possuir o cargo de suporte.",
                components: [
                    new ActionRowBuilder().addComponents(seletor)
                ],
                flags: MessageFlags.Ephemeral
            });

            return;
        }

        //====================================================
        // TRANSFERIR TICKET: PROCESSAR
        //====================================================

        if (
            interaction.isUserSelectMenu() &&
            interaction.customId === "transferir_selecionar"
        ) {
            await interaction.deferReply({
                flags: MessageFlags.Ephemeral
            });

            const canal = interaction.channel;

            if (!ehTicket(canal)) {
                return interaction.editReply(
                    "❌ Este canal não é um ticket válido."
                );
            }

            if (!ehAtendenteResponsavel(interaction)) {
                return interaction.editReply(
                    "❌ Somente o atendente responsável pode transferir o ticket."
                );
            }

            const novoAtendenteId = interaction.values[0];

            if (novoAtendenteId === interaction.user.id) {
                return interaction.editReply(
                    "❌ Você já é o atendente responsável."
                );
            }

            const cargo = obterCargoSuporte(interaction.guild);

            if (!cargo) {
                return interaction.editReply(
                    `❌ O cargo **${CARGO_SUPORTE}** não foi encontrado.`
                );
            }

            let novoAtendente;

            try {
                novoAtendente =
                    interaction.guild.members.cache.get(
                        novoAtendenteId
                    ) ||
                    await interaction.guild.members.fetch(
                        novoAtendenteId
                    );
            } catch (erro) {
                return interaction.editReply(
                    "❌ Não consegui verificar esse membro."
                );
            }

            if (!novoAtendente.roles.cache.has(cargo.id)) {
                return interaction.editReply(
                    `❌ ${novoAtendente} não possui o cargo de suporte.`
                );
            }

            const dados = lerTopico(canal);

            if (dados.status === "closed") {
                return interaction.editReply(
                    "❌ Este ticket já está fechado."
                );
            }

            await atualizarTopico(canal, {
                atendenteId: novoAtendente.id
            });

            await canal.permissionOverwrites.edit(
                novoAtendente.id,
                {
                    ViewChannel: true,
                    SendMessages: true,
                    ReadMessageHistory: true,
                    AttachFiles: true,
                    EmbedLinks: true
                }
            );

            await atualizarMensagemPrincipal(canal);

            await canal.send({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0x3498DB)
                        .setTitle("🔄 Ticket transferido")
                        .setDescription(
                            `O atendimento agora está sob responsabilidade de ${novoAtendente}.`
                        )
                        .setTimestamp()
                ]
            });

            await interaction.editReply(
                `✅ Ticket transferido para ${novoAtendente}.`
            );

            return;
        }

        //====================================================
        // ADICIONAR JOGADOR: ABRIR SELETOR
        //====================================================

        if (
            interaction.isButton() &&
            interaction.customId === "adm_adicionar"
        ) {
            if (!ehAtendenteResponsavel(interaction)) {
                return responderPrivado(
                    interaction,
                    "❌ Somente o atendente responsável pode adicionar jogadores."
                );
            }

            const seletor = new UserSelectMenuBuilder()
                .setCustomId("adicionar_selecionar")
                .setPlaceholder("Selecione o jogador")
                .setMinValues(1)
                .setMaxValues(1);

            await interaction.reply({
                content:
                    "➕ Selecione o jogador que deseja adicionar ao ticket.",
                components: [
                    new ActionRowBuilder().addComponents(seletor)
                ],
                flags: MessageFlags.Ephemeral
            });

            return;
        }

        //====================================================
        // ADICIONAR JOGADOR: PROCESSAR
        //====================================================

        if (
            interaction.isUserSelectMenu() &&
            interaction.customId === "adicionar_selecionar"
        ) {
            await interaction.deferReply({
                flags: MessageFlags.Ephemeral
            });

            const canal = interaction.channel;

            if (!ehTicket(canal)) {
                return interaction.editReply(
                    "❌ Este canal não é um ticket válido."
                );
            }

            if (!ehAtendenteResponsavel(interaction)) {
                return interaction.editReply(
                    "❌ Somente o atendente responsável pode adicionar jogadores."
                );
            }

            const jogadorId = interaction.values[0];

            if (jogadorId === client.user.id) {
                return interaction.editReply(
                    "❌ Não é necessário adicionar o próprio bot."
                );
            }

            try {
                const jogador =
                    interaction.guild.members.cache.get(jogadorId) ||
                    await interaction.guild.members.fetch(jogadorId);

                await canal.permissionOverwrites.edit(
                    jogador.id,
                    {
                        ViewChannel: true,
                        SendMessages: true,
                        ReadMessageHistory: true,
                        AttachFiles: true,
                        EmbedLinks: true
                    }
                );

                await canal.send({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0x2ECC71)
                            .setDescription(
                                `➕ ${jogador} foi adicionado ao ticket por ${interaction.user}.`
                            )
                            .setTimestamp()
                    ]
                });

                await interaction.editReply(
                    `✅ ${jogador} foi adicionado ao ticket.`
                );
            } catch (erro) {
                await interaction.editReply(
                    "❌ Não consegui adicionar esse jogador. Verifique as permissões do bot."
                );
            }

            return;
        }

        //====================================================
        // FECHAR TICKET: ABRIR MODAL
        //====================================================

        if (
            interaction.isButton() &&
            interaction.customId === "ticket_fechar"
        ) {
            const canal = interaction.channel;

            if (!ehTicket(canal)) {
                return responderPrivado(
                    interaction,
                    "❌ Este canal não é um ticket válido."
                );
            }

            const dados = lerTopico(canal);

            if (dados.status === "closed") {
                return responderPrivado(
                    interaction,
                    "❌ Este ticket já está fechado."
                );
            }

            const podeFechar =
                interaction.user.id === dados.usuarioId ||
                ehEquipe(interaction);

            if (!podeFechar) {
                return responderPrivado(
                    interaction,
                    "❌ Você não tem permissão para fechar este ticket."
                );
            }

            const modal = new ModalBuilder()
                .setCustomId("ticket_fechar_modal")
                .setTitle("Fechar ticket");

            const campoMotivo = new TextInputBuilder()
                .setCustomId("motivo_fechamento")
                .setLabel("Motivo do fechamento")
                .setPlaceholder(
                    "Explique por que o ticket está sendo fechado."
                )
                .setStyle(TextInputStyle.Paragraph)
                .setMinLength(3)
                .setMaxLength(500)
                .setRequired(true);

            modal.addComponents(
                new ActionRowBuilder().addComponents(campoMotivo)
            );

            await interaction.showModal(modal);

            return;
        }

        //====================================================
        // FECHAR TICKET: PROCESSAR MODAL
        //====================================================

        if (
            interaction.isModalSubmit() &&
            interaction.customId === "ticket_fechar_modal"
        ) {
            const canal = interaction.channel;

            if (!ehTicket(canal)) {
                return responderPrivado(
                    interaction,
                    "❌ Este canal não é um ticket válido."
                );
            }

            const dados = lerTopico(canal);

            if (dados.status === "closed") {
                return responderPrivado(
                    interaction,
                    "❌ Este ticket já está fechado."
                );
            }

            const podeFechar =
                interaction.user.id === dados.usuarioId ||
                ehEquipe(interaction);

            if (!podeFechar) {
                return responderPrivado(
                    interaction,
                    "❌ Você não tem permissão para fechar este ticket."
                );
            }

            const motivo =
                interaction.fields.getTextInputValue(
                    "motivo_fechamento"
                );

            await atualizarTopico(canal, {
                status: "closed"
            });

            await interaction.reply({
                content: "🔒 Ticket fechado com sucesso.",
                flags: MessageFlags.Ephemeral
            });

            await canal.send({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0x808080)
                        .setTitle("🔒 Ticket fechado")
                        .addFields(
                            {
                                name: "👤 Fechado por",
                                value: `${interaction.user}`,
                                inline: true
                            },
                            {
                                name: "🛠️ Atendente",
                                value: dados.atendenteId
                                    ? `<@${dados.atendenteId}>`
                                    : "Nenhum atendente",
                                inline: true
                            },
                            {
                                name: "📝 Motivo",
                                value: motivo,
                                inline: false
                            }
                        )
                        .setTimestamp()
                ]
            });

            try {
                await atualizarMensagemPrincipal(canal);
            } catch (erro) {
                console.error(
                    "Erro ao atualizar mensagem principal:",
                    erro.message
                );
            }

            // Envia a avaliação se houver atendente.

            if (dados.atendenteId) {
                try {
                    const criador = await client.users.fetch(
                        dados.usuarioId
                    );

                    const embedAvaliacao = new EmbedBuilder()
                        .setColor(0xF1C40F)
                        .setTitle("⭐ Avalie seu atendimento")
                        .setDescription(
                            "Seu ticket foi fechado!\n\n" +
                            "Queremos saber como foi sua experiência " +
                            "com nossa equipe.\n\n" +
                            "**Escolha uma nota de 1 a 5 estrelas.**\n\n" +
                            "Após escolher, você poderá escrever um " +
                            "comentário sobre o atendimento recebido.\n\n" +
                            "💎 Sua opinião é importante para o " +
                            "Adamantina Roleplay!"
                        )
                        .addFields(
                            {
                                name: "🎫 Categoria",
                                value: dados.tipo || "Não informada",
                                inline: true
                            },
                            {
                                name: "🛠️ Atendente",
                                value: `<@${dados.atendenteId}>`,
                                inline: true
                            }
                        )
                        .setFooter({
                            text: "Adamantina Roleplay • Avaliações"
                        });

                    const botoes = [];

                    for (let nota = 1; nota <= 5; nota++) {
                        botoes.push(
                            new ButtonBuilder()
                                .setCustomId(
                                    `avaliar:${nota}:${dados.usuarioId}:` +
                                    `${dados.atendenteId}:` +
                                    `${encodeURIComponent(dados.tipo || "Suporte")}:` +
                                    `${canal.id}`
                                )
                                .setLabel(`${nota} ⭐`)
                                .setStyle(
                                    nota <= 3
                                        ? ButtonStyle.Secondary
                                        : ButtonStyle.Success
                                )
                        );
                    }

                    await criador.send({
                        embeds: [embedAvaliacao],
                        components: [
                            new ActionRowBuilder().addComponents(botoes)
                        ]
                    });
                } catch (erro) {
                    console.error(
                        "Não foi possível enviar a avaliação por DM:",
                        erro.message
                    );
                }
            }

            // Exclui o canal após 15 segundos.

            setTimeout(async () => {
                try {
                    const canalAtual =
                        interaction.guild.channels.cache.get(canal.id);

                    if (canalAtual) {
                        await canalAtual.delete(
                            "Ticket fechado; exclusão automática após 15 segundos."
                        );
                    }
                } catch (erro) {
                    console.error(
                        "Erro ao excluir ticket:",
                        erro.message
                    );
                }
            }, TEMPO_EXCLUSAO);

            return;
        }

        //====================================================
        // AVALIAÇÃO: ESCOLHER ESTRELAS E ABRIR FORMULÁRIO
        //====================================================

        if (
            interaction.isButton() &&
            interaction.customId.startsWith("avaliar:")
        ) {
            const partes = interaction.customId.split(":");

            const nota = Number(partes[1]);
            const criadorId = partes[2];
            const atendenteId = partes[3];
            const tipo = decodeURIComponent(partes[4]);
            const ticketId = partes[5];

            if (
                !Number.isInteger(nota) ||
                nota < 1 ||
                nota > 5
            ) {
                return responderPrivado(
                    interaction,
                    "❌ Esta avaliação é inválida."
                );
            }

            if (interaction.user.id !== criadorId) {
                return responderPrivado(
                    interaction,
                    "❌ Somente o criador do ticket pode avaliar este atendimento."
                );
            }

            const chaveAvaliacao = `${ticketId}:${criadorId}`;

            if (avaliacoesRegistradas.has(chaveAvaliacao)) {
                return responderPrivado(
                    interaction,
                    "❌ Você já avaliou este atendimento."
                );
            }

            // Modal com o comentário do cliente.

            const modal = new ModalBuilder()
                .setCustomId(
                    `avaliar_modal:${nota}:${criadorId}:` +
                    `${atendenteId}:${encodeURIComponent(tipo)}:${ticketId}`
                )
                .setTitle("Avalie seu atendimento");

            const campoComentario = new TextInputBuilder()
                .setCustomId("comentario_atendimento")
                .setLabel("Como foi seu atendimento?")
                .setPlaceholder(
                    "Conte como foi sua experiência com nossa equipe..."
                )
                .setStyle(TextInputStyle.Paragraph)
                .setMinLength(3)
                .setMaxLength(1000)
                .setRequired(true);

            modal.addComponents(
                new ActionRowBuilder().addComponents(campoComentario)
            );

            await interaction.showModal(modal);

            return;
        }

        //====================================================
        // AVALIAÇÃO: RECEBER COMENTÁRIO E ENVIAR AO CANAL
        //====================================================

        if (
            interaction.isModalSubmit() &&
            interaction.customId.startsWith("avaliar_modal:")
        ) {
            const partes = interaction.customId.split(":");

            const nota = Number(partes[1]);
            const criadorId = partes[2];
            const atendenteId = partes[3];
            const tipo = decodeURIComponent(partes[4]);
            const ticketId = partes[5];

            if (
                !Number.isInteger(nota) ||
                nota < 1 ||
                nota > 5
            ) {
                return responderPrivado(
                    interaction,
                    "❌ Esta avaliação é inválida."
                );
            }

            if (interaction.user.id !== criadorId) {
                return responderPrivado(
                    interaction,
                    "❌ Somente o criador do ticket pode enviar esta avaliação."
                );
            }

            const chaveAvaliacao = `${ticketId}:${criadorId}`;

            if (avaliacoesRegistradas.has(chaveAvaliacao)) {
                return responderPrivado(
                    interaction,
                    "❌ Você já avaliou este atendimento."
                );
            }

            const comentario =
                interaction.fields.getTextInputValue(
                    "comentario_atendimento"
                ).trim();

            if (!comentario) {
                return responderPrivado(
                    interaction,
                    "❌ Escreva um comentário antes de enviar."
                );
            }

            await interaction.deferReply({
                flags: MessageFlags.Ephemeral
            });

            // Busca o canal de avaliações.

            let canalAvaliacoes =
                interaction.guild?.channels.cache.get(
                    CANAL_AVALIACOES
                ) ||
                client.channels.cache.get(
                    CANAL_AVALIACOES
                );

            if (!canalAvaliacoes) {
                try {
                    canalAvaliacoes = await client.channels.fetch(
                        CANAL_AVALIACOES
                    );
                } catch (erro) {
                    console.error(
                        "Erro ao buscar canal de avaliações:",
                        erro.message
                    );
                }
            }

            if (
                !canalAvaliacoes ||
                !canalAvaliacoes.isTextBased() ||
                !canalAvaliacoes.send
            ) {
                return interaction.editReply(
                    "❌ Não encontrei o canal de avaliações. Avise a administração."
                );
            }

            const estrelas = "⭐".repeat(nota);

            const embed = new EmbedBuilder()
                .setColor(
                    nota >= 4
                        ? 0x2ECC71
                        : nota === 3
                            ? 0xF1C40F
                            : 0xE74C3C
                )
                .setTitle("📊 Nova avaliação de atendimento")
                .setDescription(
                    "Um jogador enviou uma avaliação sobre o atendimento recebido."
                )
                .addFields(
                    {
                        name: "👤 Cliente",
                        value: `<@${criadorId}>`,
                        inline: true
                    },
                    {
                        name: "🛠️ Atendente",
                        value: `<@${atendenteId}>`,
                        inline: true
                    },
                    {
                        name: "⭐ Nota",
                        value: `${estrelas} (${nota}/5)`,
                        inline: false
                    },
                    {
                        name: "🎫 Categoria",
                        value: tipo || "Não informada",
                        inline: true
                    },
                    {
                        name: "🆔 Ticket",
                        value: ticketId,
                        inline: true
                    },
                    {
                        name: "📝 Como foi o atendimento?",
                        value: comentario.slice(0, 1024),
                        inline: false
                    }
                )
                .setFooter({
                    text: "Adamantina Roleplay • Avaliações"
                })
                .setTimestamp();

            try {
                await canalAvaliacoes.send({
                    embeds: [embed]
                });

                avaliacoesRegistradas.add(chaveAvaliacao);

                await interaction.editReply(
                    `✅ Obrigado por avaliar nosso atendimento!\n\n` +
                    `⭐ Sua nota: ${nota}/5\n` +
                    "📝 Seu comentário foi enviado à administração."
                );
            } catch (erro) {
                console.error(
                    "Erro ao registrar avaliação:",
                    erro
                );

                await interaction.editReply(
                    "❌ Não consegui registrar sua avaliação. Tente novamente mais tarde."
                );
            }

            return;
        }

    } catch (erro) {
        console.error(
            "❌ Erro na interação:",
            erro
        );

        try {
            if (
                interaction.isRepliable() &&
                !interaction.replied &&
                !interaction.deferred
            ) {
                await responderPrivado(
                    interaction,
                    "❌ Ocorreu um erro ao executar esta ação. Verifique os logs do bot."
                );
            }
        } catch (erroResposta) {
            console.error(
                "Erro ao responder à interação:",
                erroResposta.message
            );
        }
    }
});

//============================================================
// TRATAMENTO DE ERROS
//============================================================

process.on("unhandledRejection", erro => {
    console.error(
        "❌ Promise rejeitada:",
        erro
    );
});

process.on("uncaughtException", erro => {
    console.error(
        "❌ Erro inesperado:",
        erro
    );
});

//============================================================
// LOGIN
//============================================================

if (!TOKEN) {
    console.error(
        "❌ A variável DISCORD_TOKEN não foi configurada."
    );
} else {
    client.login(TOKEN).catch(erro => {
        console.error(
            "❌ Não foi possível conectar o bot:",
            erro
        );
    });
}
