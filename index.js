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
    Events
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

// Impede registrar duas vezes a mesma avaliação durante
// a execução atual do bot.
const avaliacoesRegistradas = new Set();

//============================================================
// FUNÇÕES DE PERMISSÃO
//============================================================

// Verifica o cargo utilizando os dados já presentes
// na interação. Não busca todos os membros do servidor.

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

// Verifica se o usuário é administrador.

function ehAdministrador(interaction) {
    return Boolean(
        interaction.memberPermissions?.has(
            PermissionFlagsBits.Administrator
        )
    );
}

// Busca o cargo de suporte pelo nome.

function obterCargoSuporte(guild) {
    return guild.roles.cache.find(
        role => role.name === CARGO_SUPORTE
    ) || null;
}

// Verifica se o usuário pertence à equipe.

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
// METADADOS DO TICKET
//============================================================

// Formato do tópico:
// ticket-user:ID|ticket-type:TIPO|attendant:ID|status:open

function criarTopico(usuarioId, tipo, atendenteId, status) {
    return [
        `ticket-user:${usuarioId}`,
        `ticket-type:${tipo}`,
        `attendant:${atendenteId || "none"}`,
        `status:${status}`
    ].join("|");
}

// Lê os dados do tópico.

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

    const partes = canal.topic.split("|");

    for (const parte of partes) {
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

// Atualiza os metadados do ticket.

async function atualizarTopico(
    canal,
    dados
) {
    const atuais = lerTopico(canal);

    const usuarioId =
        dados.usuarioId ?? atuais.usuarioId;

    const tipo =
        dados.tipo ?? atuais.tipo;

    const atendenteId =
        dados.atendenteId !== undefined
            ? dados.atendenteId
            : atuais.atendenteId;

    const status =
        dados.status ?? atuais.status;

    await canal.setTopic(
        criarTopico(
            usuarioId,
            tipo,
            atendenteId,
            status
        )
    );
}

// Verifica se um canal é um ticket.

function ehTicket(canal) {
    const dados = lerTopico(canal);

    return Boolean(
        dados.usuarioId &&
        dados.tipo
    );
}

//============================================================
// EMBED DO TICKET
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
            "Bem-vindo ao atendimento do Adamantina Roleplay.\n\n" +
            "A equipe responderá assim que possível."
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
// PAINEL ADM
//============================================================

function criarPainelAdm() {
    const embed = new EmbedBuilder()
        .setColor(0xD90429)
        .setTitle("⚙️ Painel Administrativo")
        .setDescription(
            "Gerencie este ticket utilizando as opções abaixo."
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

    const linha = new ActionRowBuilder()
        .addComponents(
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
        ephemeral: true
    };
}

//============================================================
// VERIFICA SE O ATENDENTE PODE UTILIZAR O PAINEL
//============================================================

function ehAtendenteResponsavel(interaction) {
    const dados = lerTopico(interaction.channel);

    return Boolean(
        dados.atendenteId &&
        dados.atendenteId === interaction.user.id
    );
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
    console.log(
        `🤖 Bot online: ${client.user.tag}`
    );

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

client.on(
    Events.InteractionCreate,
    async interaction => {
        try {

            //================================================
            // COMANDO /TICKET
            //================================================

            if (interaction.isChatInputCommand()) {
                if (interaction.commandName !== "ticket") {
                    return;
                }

                if (!ehAdministrador(interaction)) {
                    return interaction.reply({
                        content:
                            "❌ Somente administradores podem enviar o painel.",
                        ephemeral: true
                    });
                }

                const menu = new StringSelectMenuBuilder()
                    .setCustomId("ticket_tipo")
                    .setPlaceholder("Selecione o tipo de atendimento")
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

                const embed = new EmbedBuilder()
                    .setColor(0xD90429)
                    .setTitle("🎟️ Atendimento | Adamantina Roleplay")
                    .setDescription(
                        "Precisa de ajuda?\n\n" +
                        "Selecione abaixo a categoria desejada " +
                        "para abrir um ticket privado."
                    )
                    .setFooter({
                        text: "Adamantina Roleplay • Suporte"
                    });

                await interaction.reply({
                    embeds: [embed],
                    components: [
                        new ActionRowBuilder().addComponents(menu)
                    ]
                });

                return;
            }

            //================================================
            // SELEÇÃO DA CATEGORIA
            //================================================

            if (
                interaction.isStringSelectMenu() &&
                interaction.customId === "ticket_tipo"
            ) {
                await interaction.deferReply({
                    ephemeral: true
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
                        "❌ Não encontrei a categoria de tickets. " +
                        `Crie a categoria **${CATEGORIA_TICKETS}**.`
                    );
                }

                const cargoSuporte = obterCargoSuporte(guild);

                if (!cargoSuporte) {
                    return interaction.editReply(
                        "❌ Não encontrei o cargo de suporte: " +
                        `**${CARGO_SUPORTE}**.`
                    );
                }

                // Procura um ticket já existente sem buscar
                // membros do servidor.

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

                const nomeCanal =
                    `ticket-${nomeUsuario}`.slice(0, 90);

                const canal = await guild.channels.create({
                    name: nomeCanal,
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

                const embed = criarEmbedTicket(canal);

                await canal.send({
                    content:
                        `${interaction.user} <@&${cargoSuporte.id}>`,
                    embeds: [embed],
                    components: criarBotoesTicket()
                });

                await interaction.editReply(
                    `✅ Seu ticket foi criado: ${canal}`
                );

                return;
            }

            //================================================
            // ASSUMIR TICKET
            //================================================

            if (
                interaction.isButton() &&
                interaction.customId === "ticket_assumir"
            ) {
                const canal = interaction.channel;

                if (!ehTicket(canal)) {
                    return interaction.reply({
                        content: "❌ Este canal não é um ticket válido.",
                        ephemeral: true
                    });
                }

                if (!ehEquipe(interaction)) {
                    return interaction.reply({
                        content:
                            "❌ Você não tem permissão para assumir tickets.",
                        ephemeral: true
                    });
                }

                const dados = lerTopico(canal);

                if (dados.status === "closed") {
                    return interaction.reply({
                        content: "❌ Este ticket já está fechado.",
                        ephemeral: true
                    });
                }

                if (dados.atendenteId) {
                    return interaction.reply({
                        content:
                            `❌ Este ticket já foi assumido por <@${dados.atendenteId}>.`,
                        ephemeral: true
                    });
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

            //================================================
            // ABRIR PAINEL ADM
            //================================================

            if (
                interaction.isButton() &&
                interaction.customId === "ticket_painel_adm"
            ) {
                const canal = interaction.channel;

                if (!ehTicket(canal)) {
                    return interaction.reply({
                        content: "❌ Este canal não é um ticket válido.",
                        ephemeral: true
                    });
                }

                const dados = lerTopico(canal);

                if (dados.status === "closed") {
                    return interaction.reply({
                        content: "❌ Este ticket já está fechado.",
                        ephemeral: true
                    });
                }

                // Somente o atendente responsável pode abrir
                // o painel, sem buscar membros do servidor.

                if (!ehAtendenteResponsavel(interaction)) {
                    return interaction.reply({
                        content:
                            "❌ Somente o atendente responsável pode utilizar o Painel ADM.",
                        ephemeral: true
                    });
                }

                await interaction.reply(
                    criarPainelAdm()
                );

                return;
            }

            //================================================
            // NOTIFICAR CRIADOR
            //================================================

            if (
                interaction.isButton() &&
                interaction.customId === "adm_notificar"
            ) {
                if (!ehAtendenteResponsavel(interaction)) {
                    return interaction.reply({
                        content:
                            "❌ Somente o atendente responsável pode usar esta opção.",
                        ephemeral: true
                    });
                }

                const dados = lerTopico(interaction.channel);

                if (!dados.usuarioId) {
                    return interaction.reply({
                        content:
                            "❌ Não consegui identificar o criador do ticket.",
                        ephemeral: true
                    });
                }

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

                    return interaction.reply({
                        content:
                            "✅ Notificação enviada ao criador por DM.",
                        ephemeral: true
                    });

                } catch (erro) {
                    return interaction.reply({
                        content:
                            "❌ Não consegui enviar a DM. " +
                            "O usuário pode estar com mensagens privadas bloqueadas.",
                        ephemeral: true
                    });
                }
            }

            //================================================
            // RENOMEAR TICKET: ABRIR MODAL
            //================================================

            if (
                interaction.isButton() &&
                interaction.customId === "adm_renomear"
            ) {
                if (!ehAtendenteResponsavel(interaction)) {
                    return interaction.reply({
                        content:
                            "❌ Somente o atendente responsável pode renomear o ticket.",
                        ephemeral: true
                    });
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

            //================================================
            // RENOMEAR TICKET: SALVAR
            //================================================

            if (
                interaction.isModalSubmit() &&
                interaction.customId === "adm_renomear_modal"
            ) {
                if (!ehAtendenteResponsavel(interaction)) {
                    return interaction.reply({
                        content:
                            "❌ Somente o atendente responsável pode renomear o ticket.",
                        ephemeral: true
                    });
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
                    return interaction.reply({
                        content:
                            "❌ Informe um nome válido para o canal.",
                        ephemeral: true
                    });
                }

                await interaction.channel.setName(novoNome);

                await interaction.reply({
                    content:
                        `✅ Ticket renomeado para **${novoNome}**.`,
                    ephemeral: true
                });

                return;
            }

            //================================================
            // TRANSFERIR TICKET: ABRIR SELETOR
            //================================================

            if (
                interaction.isButton() &&
                interaction.customId === "adm_transferir"
            ) {
                if (!ehAtendenteResponsavel(interaction)) {
                    return interaction.reply({
                        content:
                            "❌ Somente o atendente responsável pode transferir o ticket.",
                        ephemeral: true
                    });
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
                    ephemeral: true
                });

                return;
            }

            //================================================
            // TRANSFERIR TICKET: PROCESSAR SELEÇÃO
            //================================================

            if (
                interaction.isUserSelectMenu() &&
                interaction.customId === "transferir_selecionar"
            ) {
                await interaction.deferReply({
                    ephemeral: true
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

                // IMPORTANTE:
                // Busca apenas o membro selecionado.
                // Não utiliza guild.members.fetch() sem ID.

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
                    console.error(
                        "Erro ao buscar novo atendente:",
                        erro.message
                    );

                    return interaction.editReply(
                        "❌ Não consegui verificar esse membro. " +
                        "Tente selecioná-lo novamente."
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

                // Atualiza a mensagem principal do ticket.

                await interaction.editReply(
                    `✅ Ticket transferido para ${novoAtendente}.`
                );

                const mensagens =
                    await canal.messages.fetch({
                        limit: 50
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
                        components: criarBotoesTicket()
                    });
                }

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

                return;
            }

            //================================================
            // ADICIONAR JOGADOR: ABRIR SELETOR
            //================================================

            if (
                interaction.isButton() &&
                interaction.customId === "adm_adicionar"
            ) {
                if (!ehAtendenteResponsavel(interaction)) {
                    return interaction.reply({
                        content:
                            "❌ Somente o atendente responsável pode adicionar jogadores.",
                        ephemeral: true
                    });
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
                    ephemeral: true
                });

                return;
            }

            //================================================
            // ADICIONAR JOGADOR: PROCESSAR SELEÇÃO
            //================================================

            if (
                interaction.isUserSelectMenu() &&
                interaction.customId === "adicionar_selecionar"
            ) {
                await interaction.deferReply({
                    ephemeral: true
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

                if (jogadorId === canal.guild.members.me?.id) {
                    return interaction.editReply(
                        "❌ Não é necessário adicionar o próprio bot."
                    );
                }

                try {
                    // Busca apenas o usuário selecionado.

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

                    return interaction.editReply(
                        `✅ ${jogador} foi adicionado ao ticket.`
                    );

                } catch (erro) {
                    console.error(
                        "Erro ao adicionar jogador:",
                        erro.message
                    );

                    return interaction.editReply(
                        "❌ Não consegui adicionar esse jogador. " +
                        "Verifique as permissões do bot."
                    );
                }
            }

            //================================================
            // FECHAR TICKET: ABRIR MODAL
            //================================================

            if (
                interaction.isButton() &&
                interaction.customId === "ticket_fechar"
            ) {
                const canal = interaction.channel;

                if (!ehTicket(canal)) {
                    return interaction.reply({
                        content: "❌ Este canal não é um ticket válido.",
                        ephemeral: true
                    });
                }

                const dados = lerTopico(canal);

                if (dados.status === "closed") {
                    return interaction.reply({
                        content: "❌ Este ticket já está fechado.",
                        ephemeral: true
                    });
                }

                const podeFechar =
                    interaction.user.id === dados.usuarioId ||
                    ehEquipe(interaction);

                if (!podeFechar) {
                    return interaction.reply({
                        content:
                            "❌ Você não tem permissão para fechar este ticket.",
                        ephemeral: true
                    });
                }

                const modal = new ModalBuilder()
                    .setCustomId("ticket_fechar_modal")
                    .setTitle("Fechar ticket");

                const campoMotivo = new TextInputBuilder()
                    .setCustomId("motivo_fechamento")
                    .setLabel("Motivo do fechamento")
                    .setPlaceholder("Explique por que o ticket está sendo fechado.")
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

            //================================================
            // FECHAR TICKET: PROCESSAR MODAL
            //================================================

            if (
                interaction.isModalSubmit() &&
                interaction.customId === "ticket_fechar_modal"
            ) {
                const canal = interaction.channel;

                if (!ehTicket(canal)) {
                    return interaction.reply({
                        content: "❌ Este canal não é um ticket válido.",
                        ephemeral: true
                    });
                }

                const dados = lerTopico(canal);

                if (dados.status === "closed") {
                    return interaction.reply({
                        content: "❌ Este ticket já está fechado.",
                        ephemeral: true
                    });
                }

                const podeFechar =
                    interaction.user.id === dados.usuarioId ||
                    ehEquipe(interaction);

                if (!podeFechar) {
                    return interaction.reply({
                        content:
                            "❌ Você não tem permissão para fechar este ticket.",
                        ephemeral: true
                    });
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
                    ephemeral: true
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
                    ],
                    components: []
                });

                // Tenta atualizar a mensagem principal.

                try {
                    const mensagens =
                        await canal.messages.fetch({
                            limit: 50
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
                            components: []
                        });
                    }
                } catch (erro) {
                    console.error(
                        "Erro ao atualizar mensagem do ticket:",
                        erro.message
                    );
                }

                // Envia a avaliação somente se houver atendente.

                if (dados.atendenteId) {
                    try {
                        const criador = await client.users.fetch(
                            dados.usuarioId
                        );

                        const embedAvaliacao = new EmbedBuilder()
                            .setColor(0xF1C40F)
                            .setTitle("⭐ Avalie seu atendimento")
                            .setDescription(
                                "Seu ticket foi fechado.\n\n" +
                                "Como foi o atendimento recebido?\n" +
                                "Escolha uma nota de 1 a 5 estrelas."
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
                            );

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

                        const linha = new ActionRowBuilder()
                            .addComponents(...botoes);

                        await criador.send({
                            embeds: [embedAvaliacao],
                            components: [linha]
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
                            interaction.guild.channels.cache.get(
                                canal.id
                            );

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

            //================================================
            // REGISTRAR AVALIAÇÃO
            //================================================

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
                    return interaction.reply({
                        content: "❌ Esta avaliação é inválida.",
                        ephemeral: true
                    });
                }

                if (interaction.user.id !== criadorId) {
                    return interaction.reply({
                        content:
                            "❌ Somente o criador do ticket pode avaliar este atendimento.",
                        ephemeral: true
                    });
                }

                const chaveAvaliacao =
                    `${ticketId}:${criadorId}`;

                if (avaliacoesRegistradas.has(chaveAvaliacao)) {
                    return interaction.reply({
                        content:
                            "❌ Você já avaliou este atendimento.",
                        ephemeral: true
                    });
                }

                const canalAvaliacoes =
                    interaction.client.channels.cache.get(
                        CANAL_AVALIACOES
                    );

                if (!canalAvaliacoes) {
                    return interaction.reply({
                        content:
                            "❌ Não encontrei o canal de avaliações. " +
                            "Avise a administração.",
                        ephemeral: true
                    });
                }

                const estrelas = "⭐".repeat(nota);

                const embed = new EmbedBuilder()
                    .setColor(
                        nota >= 4 ? 0x2ECC71 :
                        nota === 3 ? 0xF1C40F :
                        0xE74C3C
                    )
                    .setTitle("📊 Nova avaliação de atendimento")
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

                    await interaction.update({
                        content:
                            `✅ Obrigado por avaliar o atendimento com ${nota} estrela(s)!`,
                        embeds: [],
                        components: []
                    });

                } catch (erro) {
                    console.error(
                        "Erro ao registrar avaliação:",
                        erro.message
                    );

                    if (!interaction.replied && !interaction.deferred) {
                        await interaction.reply({
                            content:
                                "❌ Não consegui registrar sua avaliação.",
                            ephemeral: true
                        });
                    }
                }

                return;
            }

        } catch (erro) {
            console.error(
                "❌ Erro na interação:",
                erro
            );

            // Evita que uma falha deixe a interação sem resposta.

            try {
                if (
                    interaction.isRepliable() &&
                    !interaction.replied &&
                    !interaction.deferred
                ) {
                    await interaction.reply({
                        content:
                            "❌ Ocorreu um erro ao executar esta ação. " +
                            "Verifique os logs do bot.",
                        ephemeral: true
                    });
                }
            } catch (erroResposta) {
                console.error(
                    "Erro ao responder à interação:",
                    erroResposta.message
                );
            }
        }
    }
);

//============================================================
// TRATAMENTO DE ERROS DO PROCESSO
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
