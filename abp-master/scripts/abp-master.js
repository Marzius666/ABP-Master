Hooks.once("ready", () => {
  console.log("ABP Master Manager 5.3 loaded");

  const ICONS = {
    defensive: "modules/abp-master/icons/defensive.PNG",
    physical: "modules/abp-master/icons/physical.PNG",
    mental: "modules/abp-master/icons/mental.PNG",
    legendary: "modules/abp-master/icons/legendary.PNG"
  };

  game.abpMaster = {

    async openManager(actor) {

      if (!actor) {
        ui.notifications.warn("Nessun attore selezionato.");
        return;
      }

      const rawHD = actor.system.attributes?.hd?.total || 0;
const lvl = Math.min(rawHD, 20);

      /* ========================= */
      /* UTILITIES                 */
      /* ========================= */

      function scale(level, table) {
        let result = 0;
        for (let entry of table)
          if (level >= entry.level) result = entry.value;
        return result;
      }

      async function chooseOption(title, optionsObj) {
        return new Promise(resolve => {

          const options = Object.entries(optionsObj)
            .map(([k, v]) => `<option value="${k}">${v}</option>`)
            .join("");

          new Dialog({
            title,
            content: `<form><div class="form-group">
                      <select id="choice">${options}</select>
                      </div></form>`,
            buttons: {
              ok: {
                label: "Conferma",
                callback: html => resolve(html.find("#choice").val())
              }
            }
          }).render(true);

        });
      }

      async function cleanAllABP() {
        for (let i of actor.items.filter(i =>
          i.name.startsWith("ABP –") ||
          i.name.startsWith("Legendary –")
        )) {
          await i.delete();
        }
      }

      /* ========================= */
      /* ABP BASE                  */
      /* ========================= */

      async function applyABPBase() {

        let resistance = scale(lvl, [
          {level:3,value:1},{level:8,value:2},{level:10,value:3},
          {level:13,value:4},{level:14,value:5}
        ]);

        let deflection = scale(lvl, [
          {level:5,value:1},{level:10,value:2},{level:16,value:3},
          {level:17,value:4},{level:18,value:5}
        ]);

        let toughening = scale(lvl, [
          {level:8,value:1},{level:13,value:2},{level:16,value:3},
          {level:17,value:4},{level:18,value:5}
        ]);

        let defenseChanges = [];

        if (resistance)
          defenseChanges.push({formula:`+${resistance}`,operator:"add",priority:0,target:"allSavingThrows",type:"resist"});

        if (toughening)
          defenseChanges.push({formula:`+${toughening}`,operator:"add",priority:0,target:"nac",type:"enh"});

        if (deflection)
          defenseChanges.push({formula:`+${deflection}`,operator:"add",priority:0,target:"ac",type:"deflection"});

        if (defenseChanges.length)
          await actor.createEmbeddedDocuments("Item", [{
            name:"ABP – Difese",
            type:"buff",
            img: ICONS.defensive,
            system:{
              active:true,
              subType:"perm",
              hideFromToken:true,
              changes:defenseChanges
            }
          }]);

        /* ========================= */
        /* PROWESS                   */
        /* ========================= */

        async function buildProwess(optionsFunc, statsObj, label, icon) {

          let options = optionsFunc(lvl);
          if (!options) return;

          let pattern = await chooseOption(`Distribuzione ${label}`, options);
          let values = pattern.split("-").map(v=>parseInt(v));
          let chosen = [];

          for (let i=0;i<values.length;i++) {

            let stat = await chooseOption(
              `Scegli ${label} (${values[i]})`,
              Object.fromEntries(
                Object.entries(statsObj).filter(([k])=>!chosen.includes(k))
              )
            );

            chosen.push(stat);
          }

          for (let i=0;i<chosen.length;i++) {

            await actor.createEmbeddedDocuments("Item", [{
              name:`ABP – ${label} (${statsObj[chosen[i]]})`,
              type:"buff",
              img: icon,
              system:{
                active:true,
                subType:"perm",
                hideFromToken:true,
                changes:[{
                  formula:`+${values[i]}`,
                  operator:"add",
                  priority:0,
                  target:chosen[i],
                  type:"enh"
                }]
              }
            }]);
          }
        }

        function mentalOptions(level){
          if(level<6) return null;
          if(level<11) return {"2":"2"};
          if(level<13) return {"4":"4"};
          if(level<15) return {"4-2":"4 / 2"};
          if(level<17) return {"6-2":"6 / 2","4-4":"4 / 4"};
          if(level<18) return {"6-2-2":"6 / 2 / 2","4-4-2":"4 / 4 / 2"};
          return {"6-4-2":"6 / 4 / 2","4-4-4":"4 / 4 / 4"};
        }

        function physicalOptions(level){
          if(level<7) return null;
          if(level<12) return {"2":"2"};
          if(level<13) return {"4":"4"};
          if(level<16) return {"4-2":"4 / 2"};
          if(level<17) return {"6-2":"6 / 2","4-4":"4 / 4"};
          if(level<18) return {"6-2-2":"6 / 2 / 2","4-4-2":"4 / 4 / 2"};
          return {"6-4-2":"6 / 4 / 2","4-4-4":"4 / 4 / 4"};
        }

        const mentalStats={int:"Intelligenza",wis:"Saggezza",cha:"Carisma"};
        const physicalStats={str:"Forza",dex:"Destrezza",con:"Costituzione"};

        await buildProwess(mentalOptions,mentalStats,"Mental",ICONS.mental);
        await buildProwess(physicalOptions,physicalStats,"Physical",ICONS.physical);
      }

      /* ========================= */
      /* LEGENDARY                 */
      /* ========================= */

      async function applyLegendary() {

        if(lvl < 19) return;

        let gifts = (lvl>=20)?8:3;
        let remaining = gifts;

        let removePhysical = false;
        let removeMental = false;

        while(remaining > 0){

          const options = {
            ability:"Legendary Ability (+1 inherent)",
            body:"Legendary Body (2)",
            mind:"Legendary Mind (2)"
          };

          let choice = await chooseOption(`Gifts disponibili: ${remaining}`, options);

          const stats={
            str:"Forza",dex:"Destrezza",con:"Costituzione",
            int:"Intelligenza",wis:"Saggezza",cha:"Carisma"
          };

          if(choice === "ability"){

            let stat = await chooseOption("Scegli caratteristica", stats);

            await actor.createEmbeddedDocuments("Item",[{
              name:`Legendary – Ability (${stats[stat]})`,
              type:"buff",
              img: ICONS.legendary,
              system:{
                active:true,
                subType:"perm",
                hideFromToken:true,
                changes:[{
                  formula:"+1",
                  operator:"add",
                  priority:0,
                  target:stat,
                  type:"inherent"
                }]
              }
            }]);

            remaining--;
          }

          if(choice === "body" && remaining >= 2){
            removePhysical = true;
            remaining -= 2;
            await applyLegendarySet("Physical",["str","dex","con"],[6,6,4]);
          }

          if(choice === "mind" && remaining >= 2){
            removeMental = true;
            remaining -= 2;
            await applyLegendarySet("Mental",["int","wis","cha"],[6,6,4]);
          }
        }

        if(removePhysical){
          for (let b of actor.items.filter(i =>
            i.name.startsWith("ABP – Physical")
          )) {
            await b.delete();
          }
        }

        if(removeMental){
          for (let b of actor.items.filter(i =>
            i.name.startsWith("ABP – Mental")
          )) {
            await b.delete();
          }
        }
      }

      async function applyLegendarySet(label, stats, values){
        for(let i=0;i<stats.length;i++){
          await actor.createEmbeddedDocuments("Item",[{
            name:`Legendary – ${label} (${stats[i]})`,
            type:"buff",
            img: ICONS.legendary,
            system:{
              active:true,
              subType:"perm",
              hideFromToken:true,
              changes:[{
                formula:`+${values[i]}`,
                operator:"add",
                priority:0,
                target:stats[i],
                type:"enh"
              }]
            }
          }]);
        }
      }

      await cleanAllABP();
      await applyABPBase();
      await applyLegendary();

      ui.notifications.info("ABP sincronizzato automaticamente.");
    }
  };
});

/* ========================= */
/* PULSANTE HEADER           */
/* ========================= */

Hooks.on("renderActorSheet", (app, html) => {

  if (!game.user.isGM) return;

  const actor = app.actor;

  if (!actor) return;
  if (actor.type !== "character" && actor.type !== "npc") return;

  const header = html.closest(".app").find(".window-header");

  if (header.find(".abp-manager-button").length > 0) return;

  const button = $(`
    <a class="abp-manager-button" style="margin-left:8px;">
      <i class="fas fa-star"></i> ABP
    </a>
  `);

  button.on("click", () => {
    game.abpMaster.openManager(actor);
  });

  header.find(".window-title").after(button);
});

/* ========================= */
/* AUTO LEVEL UP SYNC        */
/* ========================= */

Hooks.on("updateActor", async (actor, changes) => {

  if (!game.user.isGM) return;
  if (actor.type !== "character") return;

  const newLevel = changes?.system?.details?.level?.value;
  if (newLevel === undefined) return;

  if (actor.getFlag("abp-master", "syncing")) return;

  await actor.setFlag("abp-master", "syncing", true);
  await game.abpMaster.openManager(actor);
  await actor.unsetFlag("abp-master", "syncing");
});