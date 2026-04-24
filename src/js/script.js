<script>
      // [AI-READ]: Inicializa iconos globalmente por primera vez.
      lucide.createIcons();

      // --- LÓGICA DEL SIDEBAR BOOTSTRAP ---
      document
        .getElementById("menu-toggle")
        .addEventListener("click", function (e) {
          e.preventDefault();
          document
            .getElementById("sidebar-wrapper")
            .classList.toggle("toggled");
        });

      // --- LÓGICA PARA EL MODAL DE CONTRASEÑA ENMASCARADA ---
      // [AI-READ]: Uso excelente de Promesas para pausar la ejecución de JS hasta que el usuario responda el modal.
      let passwordResolve = null;

      function solicitarPassword(mensaje = "Ingresa tu contraseña:") {
        return new Promise((resolve) => {
          document.getElementById("password-msg").innerText = mensaje;
          const input = document.getElementById("password-input");
          input.value = "";

          const modalEl = document.getElementById("passwordModal");
          let modal = bootstrap.Modal.getInstance(modalEl);
          if (!modal) {
            modal = new bootstrap.Modal(modalEl, {
              backdrop: "static", 
              keyboard: false,
            });
          }
          passwordResolve = resolve;

          modal.show();

          modalEl.addEventListener(
            "shown.bs.modal",
            function () {
              input.focus();
            },
            { once: true },
          );

          modalEl.addEventListener(
            "hidden.bs.modal",
            function () {
              if (passwordResolve) {
                passwordResolve(null);
                passwordResolve = null;
              }
            },
            { once: true },
          );
        });
      }

      document
        .getElementById("btn-confirm-password")
        .addEventListener("click", () => {
          if (passwordResolve) {
            const val = document.getElementById("password-input").value;
            const resolveFn = passwordResolve;
            passwordResolve = null; 

            const modalEl = document.getElementById("passwordModal");
            const modal = bootstrap.Modal.getInstance(modalEl);
            modal.hide();

            resolveFn(val);
          }
        });

      // --- VARIABLES DE ESTADO GLOBAL ---
      let usuarioActivo = "Sistema";
      let sucursales = [],
        plantillaGlobal = [],
        horariosGlobal = [],
        historialGlobal = [];
      let auditoriasGlobal = [],
        auditoresGlobal = [],
        rolesGlobal = [];
      let horariosPersonalGlobal = []; 
      let sucursalActualId = null;
      let sucursalAuditoriaSeleccionada = null;
      let detalleAuditoriaGlobal = [];
      let sesionEstadisticaActiva = false;
      let diaSeleccionado = "TODOS";
      let currentHorarioSimi = "";
      let currentHorarioSemana = "";
      let cajaChicaGlobal = [];
      let cambiosPendientesEstatus = {};

      // --- SISTEMA DE CONTROL DE ACCESO ---
      async function validarAcceso(permisoRequerido, mensajeCustom) {
        const pass = await solicitarPassword(
          mensajeCustom || "Ingresa tu contraseña de acceso:",
        );
        if (pass === null) return false;
        if (!pass) {
          alert("❌ Contraseña incorrecta o vacía.");
          return false;
        }

        const usuario = rolesGlobal.find((r) => r.password === pass);
        if (!usuario) {
          alert("❌ Contraseña incorrecta.");
          return false;
        }

        if (
          usuario.permisos.includes("TODO") ||
          usuario.permisos.includes(permisoRequerido)
        ) {
          usuarioActivo = usuario.rol;
          return true;
        } else {
          alert(`⛔ Acceso denegado.`);
          return false;
        }
      }

      // --- UTILIDADES ---
      function obtenerSemanaActual() {
        const d = new Date();
        d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
        return d.getUTCFullYear() + "-W" + String(weekNo).padStart(2, "0");
      }

      function formatearMonedaInput(input) {
        let val = parseFloat(input.value.replace(/[^0-9.-]+/g, ""));
        if (isNaN(val) || val === 0) {
          input.value = "";
        } else {
          input.value = "$ " + val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }
      }

      function limpiarFormatoInput(input) {
        let val = parseFloat(input.value.replace(/[^0-9.-]+/g, ""));
        input.value = isNaN(val) || val === 0 ? "" : val;
      }

      function formatVentasCompactas(num) {
        if (!num || num === 0) return "$0";
        if (num >= 1000000) return "$" + (num / 1000000).toFixed(1) + " M";
        if (num >= 1000) return "$" + (num / 1000).toFixed(1) + " K";
        return "$" + num.toFixed(2);
      }

      function formatDate(dateString, formatShort = false) {
        if (!dateString) return "";
        const d = new Date(dateString);
        if (isNaN(d)) return dateString;
        return formatShort ? d.toLocaleDateString() : d.toLocaleString();
      }

      // --- CAPA DE DATOS (FETCH & HYDRATION) ---
      async function descargarDatosDeAPI() {
        const status = document.getElementById("mensaje-estado");
        status.innerHTML = '<i data-lucide="loader" class="spin"></i> Sincronizando...';
        lucide.createIcons();
        try {
          const response = await fetch(API_URL);
          const data = await response.json();

          // Hidratación de Sucursales
          sucursales = data.detalle.slice(1).map((col, i) => ({
              id: "row-" + i,
              claveFr: col[1] || "",
              claveSimi: col[2]?.toString().trim() || "",
              nombre: col[3] || "",
              telefono: col[6] || "",
              vtaMensual: parseFloat(col[7]) || 0,
              supervisor: col[8] || "",
              diaPedido: col[9] || "",
              entrega: col[11] || "",
              estadistica: col[12] || "",
              correo: col[13] || "",
              p_optima: parseInt(col[14]) || 0,
              spos: col[15]?.toString().trim() || "",
              cajachica: col[17] || "",
              contabilidad: col[18] || "",
              coordinacion: col[21] || "",
              rh: col[22] || "",
              nomina: col[23] || "",
            })).filter((s) => s.nombre);

          sucursales.sort((a, b) => a.nombre.localeCompare(b.nombre));

          // Hidratación de Plantilla
          plantillaGlobal = data.plantilla.slice(1).map((col) => ({
              claveSucursal: col[0]?.toString().trim(),
              noEmpleado: col[1]?.toString().trim() || "",
              nombre: col[2] || "",
              puesto: col[3] || "",
              telefono: col[4] || "",
              fechaModif: col[5] || "",
              userModif: col[6] || "",
            })).filter((p) => p.nombre);

          // Hidratación de Horarios
          horariosGlobal = data.horarios.slice(1).map((col) => ({
            claveSucursal: col[0]?.toString().trim(),
            dia: col[1],
            apertura: col[2],
            cierre: col[3],
          }));

          // Hidratación de Horarios Personal (RH)
          if (data.horariosPersonal && data.horariosPersonal.length > 1) {
            horariosPersonalGlobal = data.horariosPersonal.slice(1).map((col, idx) => ({
                idRow: idx + 2,
                folio: col[0]?.toString().trim(),
                semana: col[2]?.toString().trim(),
                claveSimi: col[3]?.toString().trim(),
                noEmpleado: col[5]?.toString().trim(),
                empleado: col[6]?.toString().trim(),
                puesto: col[7]?.toString().trim(),
                turnos: col[8] ? JSON.parse(col[8]) : {},
                estatus: col[11]?.toString().trim() || "Revisión",
              }));
          }

          // Historial y Auditorías
          if (data.historial && data.historial.length > 1) {
            historialGlobal = data.historial.slice(1).map((col, idx) => ({
                idRow: idx + 2,
                fecha: col[0],
                sucursal: col[1],
                accion: col[2],
                empleado: col[3],
                detalle: col[4],
                informado: col[5],
                usuario: col[6] || "Sistema",
              })).reverse();
          }

          if (data.auditorias && data.auditorias.length > 1) {
            auditoriasGlobal = data.auditorias.slice(1).map((col, idx) => ({
              idRow: idx + 2,
              fechaRegistro: col[0],
              claveSimi: col[1]?.toString().trim(),
              sucursal: col[2],
              fechaProg: col[3],
              auditor: col[4],
              pernocta: col[5],
              estado: col[6],
              hora: col[7] || "",
              apoyo: col[8] || "",
              tipo: col[12] || "ORDINARIA",
              motivo: col[13] || "NORMAL",
            }));
            const auditoresSet = new Set();
            auditoriasGlobal.forEach((a) => { if (a.auditor) auditoresSet.add(a.auditor.trim()); });
            auditoresGlobal = Array.from(auditoresSet).sort();
          }

          if (data.accesos) {
            rolesGlobal = data.accesos.slice(1).map((col) => ({
              rol: col[0],
              password: col[1]?.toString(),
              permisos: col[2]?.toString().toUpperCase(),
            }));
          }

          // Renderizado Inicial
          actualizarDataLists();
          actualizarContadoresDias();
          mostrarSucursales(sucursales);
          renderizarTablaPedidos(sucursales);
          renderizarListasAuditoria();
          
          status.innerHTML = `<i data-lucide="check-circle"></i> Actualizado ${new Date().toLocaleTimeString()}`;
          lucide.createIcons();
        } catch (e) {
          status.innerHTML = '<i data-lucide="alert-circle"></i> Error de conexión';
          lucide.createIcons();
        }
      }

      // --- MÓDULO: NAVEGACIÓN ---
      function cambiarVista(vista) {
        const vistas = ["visor", "pedidos", "auditoria", "detalle-auditoria", "horarios", "caja-chica"];
        vistas.forEach(v => {
          const el = document.getElementById("vista-" + v);
          if(el) el.style.display = (v === vista) ? "block" : "none";
        });

        document.querySelectorAll(".sidebar-nav-item, .sidebar-subnav-item")
                .forEach(el => el.classList.remove("active"));
        
        const tabEl = document.getElementById("tab-" + vista);
        if (tabEl) tabEl.classList.add("active");

        if (window.innerWidth <= 768) {
          document.getElementById("sidebar-wrapper").classList.add("toggled");
        }
      }

      // --- MÓDULO: RECURSOS HUMANOS (RH) ---
      let horariosModalActual = [];

      async function abrirModuloHorarios() {
        if (await validarAcceso("EDICION", "Ingresa contraseña (Admin o RH):")) {
          cambiarVista("horarios");
          renderizarTablaHorariosRH();
        }
      }

      function renderizarTablaHorariosRH() {
        const semana = document.getElementById("input-semana-horarios").value;
        const tbody = document.getElementById("body-horarios-rh");
        let counts = { sin: 0, rev: 0, aut: 0, obs: 0 };

        tbody.innerHTML = sucursales.map((s, i) => {
          const horSuc = horariosPersonalGlobal.filter(h => h.claveSimi === s.claveSimi && h.semana === semana);
          let estatusClase = "status-sin-horario", estatusTexto = "Sin Horario", icon = "alert-circle";
          
          if (horSuc.length > 0) {
            const hasObs = horSuc.some(h => h.estatus.toUpperCase() === "OBSERVACIONES");
            const allAut = horSuc.every(h => h.estatus.toUpperCase().includes("AUTORIZAD"));
            
            if (hasObs) { estatusClase = "status-observaciones"; estatusTexto = "Observaciones"; icon = "eye"; counts.obs++; }
            else if (allAut) { estatusClase = "status-autorizado"; estatusTexto = "Autorizadas"; icon = "check-circle"; counts.aut++; }
            else { estatusClase = "status-revision"; estatusTexto = "En Revisión"; icon = "clock"; counts.rev++; }
          } else { counts.sin++; }

          return `<tr class="${estatusClase} fila-clickable" onclick="abrirDetalleHorarioRH('${s.claveSimi}', '${semana}')">
                    <td>${i + 1}</td>
                    <td><strong>${s.nombre}</strong></td>
                    <td>${s.claveFr}</td>
                    <td style="color:var(--text-muted);">${s.claveSimi}</td>
                    <td style="font-weight:bold;"><i data-lucide="${icon}" style="width:14px;"></i> ${estatusTexto}</td>
                  </tr>`;
        }).join("");

        document.getElementById("cnt-sin-horario").innerText = `${counts.sin} Sin Horario`;
        document.getElementById("cnt-revision").innerText = `${counts.rev} Revisión`;
        document.getElementById("cnt-observaciones").innerText = `${counts.obs} Observaciones`;
        document.getElementById("cnt-autorizado").innerText = `${counts.aut} Autorizadas`;
        lucide.createIcons();
      }

      function abrirDetalleHorarioRH(claveSimi, semana) {
        currentHorarioSimi = claveSimi;
        currentHorarioSemana = semana;
        horariosModalActual = horariosPersonalGlobal.filter(h => h.claveSimi === claveSimi && h.semana === semana);
        
        // Default: Auténtica carga inicial
        horariosModalActual.forEach(emp => {
          if (emp.turnos) Object.keys(emp.turnos).forEach(d => emp.turnos[d].aut = true);
        });

        renderizarDetalleHorarioRH();
        new bootstrap.Modal(document.getElementById("modalDetalleHorarios")).show();
      }

      function renderizarDetalleHorarioRH() {
        const tbody = document.getElementById("body-modal-horarios");
        const dias = ["Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado", "Domingo"];
        
        tbody.innerHTML = horariosModalActual.map((emp, idx) => {
          let diasObs = 0;
          let tr = `<tr><td><b>${emp.noEmpleado} - ${emp.empleado}</b></td>`;
          
          dias.forEach(dia => {
            const d = emp.turnos[dia] || { t1: "", aut: false };
            const isAut = d.aut === true || d.aut === "true";
            if (!isAut) diasObs++;
            tr += `<td>
                    <div style="font-size:11px;">${d.t1 || "Descanso"}</div>
                    <div onclick="toggleDiaMejora(${idx}, '${dia}')" style="cursor:pointer;">
                      <i data-lucide="${isAut ? "check-circle-2" : "alert-circle"}" style="color:${isAut ? "#10b981" : "#f97316"}; width:18px;"></i>
                    </div>
                  </td>`;
          });
          
          emp.estatusGeneral = diasObs > 0 ? "OBSERVACIONES" : "AUTORIZADO";
          tr += `<td><span class="badge ${emp.estatusGeneral === 'AUTORIZADO' ? 'bg-success' : 'bg-warning'}">${emp.estatusGeneral}</span></td></tr>`;
          return tr;
        }).join("");
        lucide.createIcons();
      }

      function toggleDiaMejora(idx, dia) {
        horariosModalActual[idx].turnos[dia].aut = !horariosModalActual[idx].turnos[dia].aut;
        renderizarDetalleHorarioRH();
      }

      async function guardarAutorizacionHorarios() {
        const payload = {
          accion: "UPDATE_HORARIO_AUT",
          folio: horariosModalActual[0]?.folio,
          claveSimi: currentHorarioSimi,
          semana: currentHorarioSemana,
          items: horariosModalActual.map(e => ({ noEmpleado: e.noEmpleado, turnos: e.turnos, estatusEmpleado: e.estatusGeneral }))
        };
        const resp = await fetch(API_URL, { method: "POST", body: JSON.stringify(payload) });
        if ((await resp.json()).status === "success") {
          bootstrap.Modal.getInstance(document.getElementById("modalDetalleHorarios")).hide();
          descargarDatosDeAPI();
        }
      }

      // --- MÓDULO: AUDITORÍAS ---
      async function abrirModuloAuditorias() {
        if (await validarAcceso("AUDITORIA")) cambiarVista("auditoria");
      }

      function renderizarListasAuditoria() {
        const mes = document.getElementById("filtro-mes-auditoria").value;
        const programadas = auditoriasGlobal.filter(a => a.estado === "Programada" && a.fechaProg.includes(mes));
        
        document.getElementById("tbody-programadas").innerHTML = programadas.map(a => 
          `<tr><td><strong>${a.sucursal}</strong></td><td>${formatDate(a.fechaProg, true)}</td></tr>`
        ).join("") || "<tr><td colspan='2'>No hay programas</td></tr>";
        
        lucide.createIcons();
      }

      // --- MÓDULO: CAJA CHICA ---
      async function abrirModuloCajaChica() {
        if (await validarAcceso("REVISORCH")) {
          await cargarDatosCajaChica();
          cambiarVista("caja-chica");
          renderizarCajaChica();
        }
      }

      async function cargarDatosCajaChica() {
        const res = await fetch(API_URL + "?accion=GET_CAJA_CHICA");
        const data = await res.json();
        cajaChicaGlobal = data.slice(1).map(col => ({
          folio: col[0], fechaRegistro: col[1], claveSimi: col[3]?.toString().trim(),
          importe: col[11], estatus: col[14], idLinea: col[15], url: col[13]
        }));
      }

      function renderizarCajaChica() {
        const mes = document.getElementById("filtro-mes-caja").value;
        const tbody = document.getElementById("body-caja-chica");
        
        tbody.innerHTML = sucursales.map((s, i) => {
          const regs = cajaChicaGlobal.filter(r => r.claveSimi === s.claveSimi && r.fechaRegistro.includes(mes));
          const estatus = regs.length > 0 ? regs[0].estatus : "SIN ENVÍO";
          return `<tr>
                    <td>${i+1}</td><td>${s.claveFr}</td><td>${s.claveSimi}</td>
                    <td><strong>${s.nombre}</strong></td>
                    <td><span class="badge bg-secondary">${estatus}</span></td>
                  </tr>`;
        }).join("");
      }

      // --- MÓDULO: PEDIDOS ---
      function renderizarTablaPedidos(lista) {
        const tbody = document.getElementById("body-pedidos");
        tbody.innerHTML = lista.map(s => `
          <tr data-clavesimi="${s.claveSimi}" data-venta="${s.vtaMensual}">
            <td>${s.nombre}</td>
            <td>$ ${(s.vtaMensual/4).toFixed(2)}</td>
            <td><input type="text" class="input-capture" oninput="calcularDescuento(this)" placeholder="$ 0.00"></td>
            <td><input type="text" class="input-capture" placeholder="Folio"></td>
          </tr>
        `).join("");
      }

      function calcularDescuento(input) {
        const val = parseFloat(input.value.replace(/[^0-9.-]+/g, "")) || 0;
        const fila = input.closest("tr");
        // Lógica de cálculo 35%...
      }

      // [AI-READ]: Inicialización de la SPA.
      window.onload = () => {
        const monthStr = new Date().toISOString().slice(0, 7);
        document.getElementById("filtro-mes-auditoria").value = monthStr;
        descargarDatosDeAPI();
      };

    </script>