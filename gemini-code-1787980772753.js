() {
        const audio = document.getElementById("audioStreamPlayer");
        const icon = document.getElementById("radioPlayIcon");
        const text = document.getElementById("radioPlayText");
        const led = document.getElementById("radioLed");
        const select = document.getElementById("selectRadioStation");

        if (!audio.src || audio.src === window.location.href) {
            audio.src = select.value;
        }

        if (audio.paused) {
            audio.play().catch(err => console.log("Error reproduciendo audio:", err));
            icon.innerText = "⏸";
            text.innerText = "Pausar";
            led.classList.add("active");
        } else {
            audio.pause();
            icon.innerText = "▶";
            text.innerText = "Escuchar";
            led.classList.remove("active");
        }
    }

    function cambiarEstacionRadio() {
        const audio = document.getElementById("audioStreamPlayer");
        const select = document.getElementById("selectRadioStation");
        const wasPlaying = !audio.paused;
        audio.src = select.value;
        if (wasPlaying) {
            audio.play().catch(err => console.log(err));
        }
    }

    function cambiarVolumenRadio(valor) {
        document.getElementById("audioStreamPlayer").volume = valor;
    }

    /* GESTIÓN DE DATOS EN LA TABLA */
    function renderizarTabla() {
        estadoSucursales.sort((a, b) => {
            let pctA = a.meta > 0 ? (a.venta / a.meta) * 100 : 0;
            let pctB = b.meta > 0 ? (b.venta / b.meta) * 100 : 0;
            return pctB - pctA;
        });

        const tbody = document.getElementById('tablaSucursales');
        tbody.innerHTML = '';
        let totalGeneral = 0;

        estadoSucursales.forEach((sucursal, index) => {
            let pct = sucursal.meta > 0 ? (sucursal.venta / sucursal.meta) * 100 : 0;
            if (pct > 100) pct = 100;
            totalGeneral += parseFloat(sucursal.venta) || 0;

            const posClass = index < 3 ? `pos-${index + 1}` : '';
            const esActiva = usuarioActual === sucursal.nombre ? 'sucursal-activa' : '';
            const key = sucursal.nombre.replace(/[.#$\[\]]/g, "_");
            const estaConectado = puntosConectadosMap[key] && puntosConectadosMap[key].online;
            const badgeConectado = estaConectado ? '<span style="font-size:0.6rem; color:#10b981; margin-left:6px;">🟢 ONLINE</span>' : '';

            const bloqueado = (rolActual === "SUCURSAL" && usuarioActual !== sucursal.nombre) ? 'disabled' : '';

            tbody.innerHTML += `
                <tr class="${posClass} ${esActiva}">
                    <td style="text-align: center;"><span class="rank-badge">${index + 1}</span></td>
                    <td>
                        <div class="store-cell">
                            <img src="logo shota.jpeg" class="shota-logo-mini" alt="Logo">
                            <div>
                                <div class="store-name">${sucursal.nombre} ${badgeConectado}</div>
                                <input type="text" class="input-dark" style="margin-top:4px;" value="${sucursal.asesores}" placeholder="Nombres de asesores..." onchange="actualizarDato('${sucursal.nombre}', 'asesores', this.value)" ${bloqueado}>
                            </div>
                        </div>
                    </td>
                    <td><input type="number" class="input-dark" value="${sucursal.meta}" onchange="actualizarDato('${sucursal.nombre}', 'meta', this.value)" ${bloqueado}></td>
                    <td><input type="number" class="input-dark" value="${sucursal.venta}" onchange="actualizarDato('${sucursal.nombre}', 'venta', this.value)" ${bloqueado}></td>
                    <td>
                        <div class="progress-container">
                            <div class="progress-bar" style="width: ${pct}%"></div>
                        </div>
                    </td>
                    <td class="pct-text">${pct.toFixed(1)}%</td>
                </tr>
            `;
        });

        const txtGeneral = (rolActual === "SUPERADMIN" || rolActual === "SUBADMIN") ? `$${totalGeneral.toFixed(2)} MXN` : "🔒 ACCESO RESTRINGIDO";
        document.getElementById('granTotal').innerText = txtGeneral;
    }

    function actualizarDato(sucursal, campo, valor) {
        const fechaAct = document.getElementById('fechaRegistro').value;
        db.ref(`ventas/${fechaAct}/${sucursal}/${campo}`).set(valor);
    }

    function escucharFirebase() {
        const fechaAct = document.getElementById('fechaRegistro').value;
        db.ref(`ventas/${fechaAct}`).on('value', (snapshot) => {
            const datos = snapshot.val() || {};
            estadoSucursales.forEach(s => {
                if (datos[s.nombre]) {
                    s.meta = parseFloat(datos[s.nombre].meta) || 10000;
                    s.venta = parseFloat(datos[s.nombre].venta) || 0;
                    s.asesores = datos[s.nombre].asesores || '';
                } else {
                    s.meta = 10000; s.venta = 0; s.asesores = '';
                }
            });
            renderizarTabla();
        });
    }

    function cargarDatosFecha() {
        db.ref(`ventas`).off();
        escucharFirebase();
    }

    function recargarDatosNube() {
        cargarDatosFecha();
        cargarTop10DiaAnterior();
    }

    function cargarTop10DiaAnterior() {
        const ayer = new Date();
        ayer.setDate(ayer.getDate() - 1);
        const strAyer = ayer.toISOString().slice(0, 10);
        document.getElementById('fechaDiaAnterior').innerText = strAyer;

        db.ref(`ventas/${strAyer}`).once('value').then(snapshot => {
            const datos = snapshot.val();
            const contenedor = document.getElementById('contenedorTop10');
            contenedor.innerHTML = '';

            if (!datos) {
                contenedor.innerHTML = '<div style="color:#94a3b8; font-size:0.85rem;">Sin registros del día anterior.</div>';
                return;
            }

            let ranking = [];
            Object.keys(datos).forEach(sucursal => {
                const v = parseFloat(datos[sucursal].venta) || 0;
                const m = parseFloat(datos[sucursal].meta) || 1;
                ranking.push({ nombre: sucursal, porcentaje: (v / m) * 100 });
            });

            ranking.sort((a, b) => b.porcentaje - a.porcentaje);
            const top10 = ranking.slice(0, 10);

            top10.forEach((item, index) => {
                const posCls = index < 3 ? `pos-${index + 1}` : '';
                contenedor.innerHTML += `
                    <div class="top10-item ${posCls}">
                        <strong>#${index + 1} ${item.nombre}</strong>
                        <span style="color:#38bdf8;">${item.porcentaje.toFixed(1)}%</span>
                    </div>
                `;
            });
        });
    }

    /* CHAT EN VIVO */
    function toggleChat() {
        const widget = document.getElementById('chatFloatingWidget');
        const icon = document.getElementById('chatToggleIcon');
        const badge = document.getElementById('chatBadge');

        widget.classList.toggle('collapsed');
        if (widget.classList.contains('collapsed')) {
            icon.innerText = "▲";
        } else {
            icon.innerText = "▼";
            badge.innerText = "0";
            badge.style.display = 'none';
            const chatBody = document.getElementById('chatMessages');
            chatBody.scrollTop = chatBody.scrollHeight;
        }
    }

    function handleChatKeyPress(e) {
        if (e.key === 'Enter') enviarMensajeChat();
    }

    function enviarMensajeChat() {
        const input = document.getElementById('chatInput');
        const txt = input.value.trim();
        if (!txt || !usuarioActual) return;

        const msgData = {
            user: usuarioActual,
            role: rolActual,
            text: txt,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        };

        db.ref('chat').push(msgData);
        input.value = '';
    }

    function escucharChatEnVivo() {
        db.ref('chat').limitToLast(40).on('child_added', snapshot => {
            const msg = snapshot.val();
            const chatBody = document.getElementById('chatMessages');
            const isDocAdmin = msg.role === 'SUPERADMIN' || msg.role === 'SUBADMIN';
            const clsAdmin = isDocAdmin ? 'admin-msg' : '';
            
            const btnEliminar = (rolActual === 'SUPERADMIN') ? `<button class="btn-delete-msg" onclick="eliminarMensajeChat('${snapshot.key}')">✖</button>` : '';

            const div = document.createElement('div');
            div.className = `chat-msg ${clsAdmin}`;
            div.id = `msg-${snapshot.key}`;
            div.innerHTML = `
                <div class="msg-header">
                    <span class="msg-user">${msg.user} ${isDocAdmin ? '👑' : ''}</span>
                    <span>${new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} ${btnEliminar}</span>
                </div>
                <div class="msg-text">${msg.text}</div>
            `;
            chatBody.appendChild(div);
            chatBody.scrollTop = chatBody.scrollHeight;

            const widget = document.getElementById('chatFloatingWidget');
            if (widget.classList.contains('collapsed')) {
                const badge = document.getElementById('chatBadge');
                badge.style.display = 'inline-block';
                badge.innerText = parseInt(badge.innerText) + 1;
            }
        });

        db.ref('chat').on('child_removed', snapshot => {
            const msgDiv = document.getElementById(`msg-${snapshot.key}`);
            if (msgDiv) msgDiv.remove();
        });
    }

    function eliminarMensajeChat(key) {
        if (confirm('¿Eliminar este mensaje?')) {
            db.ref(`chat/${key}`).remove();
        }
    }

    /* DESCARGA E HISTÓRICO */
    function descargarComoImagen() {
        html2canvas(document.getElementById('carreraVentas'), { backgroundColor: '#080c14' }).then(canvas => {
            const link = document.createElement('a');
            link.download = `Ventas_Shota_${document.getElementById('fechaRegistro').value}.png`;
            link.href = canvas.toDataURL();
            link.click();
        });
    }

    function cerrarSesion() {
        if (usuarioActual) {
            const nodeKey = usuarioActual.replace(/[.#$\[\]]/g, "_");
            db.ref(`puntos_conectados/${nodeKey}`).remove();
        }
        location.reload();
    }

    function abrirHistórico() {
        document.getElementById('modalHistorico').style.display = 'flex';
        const hoy = new Date();
        document.getElementById('filtroMes').value = `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}`;
        cargarHistóricoMes();
    }

    function cargarHistóricoMes() {
        const mesFiltro = document.getElementById('filtroMes').value; 
        db.ref('ventas').once('value').then(snap => {
            const datos = snap.val() || {};
            let acumulado = {};
            
            Object.keys(datos).forEach(fecha => {
                if (fecha.startsWith(mesFiltro)) {
                    Object.keys(datos[fecha]).forEach(suc => {
                        if (!acumulado[suc]) acumulado[suc] = 0;
                        acumulado[suc] += parseFloat(datos[fecha][suc].venta) || 0;
                    });
                }
            });

            let cont = document.getElementById('contenidoHistorico');
            if (Object.keys(acumulado).length === 0) {
                cont.innerHTML = `<p style="color:#f8fafc;">Sin datos para ${mesFiltro}</p>`;
                return;
            }

            let htmlStr = `<table style="width:100%; text-align:left;"><tr><th>Sucursal</th><th>Total Acumulado Venta</th></tr>`;
            Object.entries(acumulado).sort((a,b)=>b[1]-a[1]).forEach(([s, v]) => {
                htmlStr += `<tr><td style="color:#f8fafc; font-family:'Orbitron';">${s}</td><td style="color:#10b981;">$${v.toFixed(2)}</td></tr>`;
            });
            htmlStr += `</table>`;
            cont.innerHTML = htmlStr;
        });
    }

    function abrirPanelAdmin() {
        document.getElementById('modalAdmin').style.display = 'flex';
        renderListaRadioAdmin();
    }

    function cerrarModal(id) {
        document.getElementById(id).style.display = 'none';
    }

    function guardarPasswordSucursal() {
        const suc = document.getElementById('selSucursalPass').value;
        const p = document.getElementById('newPassSucursal').value;
        if(p.trim() !== '') {
            passwordsSucursales[suc] = p;
            alert(`Password actualizado para ${suc}`);
        }
    }

    function agregarEstacionRadioAdmin() {
        const n = document.getElementById('nuevaRadioNombre').value;
        const u = document.getElementById('nuevaRadioURL').value;
        if(n && u) {
            estacionesRadio.push({nombre: n, url: u});
            document.getElementById('nuevaRadioNombre').value = '';
            document.getElementById('nuevaRadioURL').value = '';
            renderListaRadioAdmin();
            renderSelectorRadio();
        }
    }

    function renderListaRadioAdmin() {
        const cont = document.getElementById('contenedorListaRadioAdmin');
        cont.innerHTML = '';
        estacionesRadio.forEach((est, idx) => {
            cont.innerHTML += `<div style="color:#38bdf8; font-size:0.8rem; margin-bottom:4px;">- ${est.nombre} <button onclick="eliminarRadioAdmin(${idx})" style="background:none; border:none; color:red; cursor:pointer;">✖</button></div>`;
        });
    }

    function eliminarRadioAdmin(idx) {
        estacionesRadio.splice(idx, 1);
        renderListaRadioAdmin();
        renderSelectorRadio();
    }

    function agregarSubAdmin() {
        const val = document.getElementById('newSubAdminPass').value;
        if(val) {
            subAdminsList.push(val);
            document.getElementById('listaSubAdmins').innerHTML += `<div style="color:#f59e0b; font-size:0.85rem;">Clave: ${val}</div>`;
            document.getElementById('newSubAdminPass').value = '';
        }
    }

</script>
</body>
</html>