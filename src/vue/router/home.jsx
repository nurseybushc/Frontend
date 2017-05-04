import { mapState } from "vuex";

const gameMap = {
  skyrim: "Skyrim Classic",
  skyrimse: "Skryim SE",
  fallout: "Fallout"
};

export default {
  computed: {
    ...mapState({
      modlists: state => state.persistent.modlists
    })
  },
  created() {
    this.$store.dispatch("getModlists");
  },
  render(h) {
    return (
      <div>
        <section>
          <h1>What is Modwatch</h1>
          <p>
            Modwatch is a site for uploading and sharing modlists for Skyrim (and eventually other games).
            If you want to view some of the 5000+ modlists, you can look through the dropdown to the right.
            Or if you have one in mind, you can view it at modwat.ch/u/username.
          </p>
        </section>
        <section>
          <h1>Uploading Your Mods</h1>
          <p>
            If you want to upload your own modlist, you can download the uploader via the gigantic orange button at the top of the page.
            Instructions for uploading are detailed on the nexus page.
          </p>
        </section>
        <section>
          <h1>Search Modlists</h1>
          <div>
            <table class="modlists-table">
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Game</th>
                  <th class="responsive-hide">Timestamp</th>
                </tr>
              </thead>
              {this.modlists.map(m => (
                <tr>
                  <td>{m.username}</td>
                  <td>{gameMap[m.game || "skyrim"]}</td>
                  <td class="responsive-hide">{new Date(m.timestamp).toLocaleDateString()}</td>
                </tr>
              ))}
            </table>
          </div>
        </section>
      </div>
    );
  }
}