import { yearOf } from '../lib/theme.js'

/**
 * Method, sources and limits. Written for a general reader; every
 * source difference between the three tournaments is stated plainly.
 */
export default function Methodology({ overview, doc }) {
  const scale = overview.calibration.statsbomb_to_fifa_pass_scale
  return (
    <details className="method">
      <summary>How this was made — data, method and limits</summary>
      <div className="method-grid">
        <section>
          <h3>The method</h3>
          <p>
            For each team at each World Cup we build a passing network: players are dots, completed passes between
            two teammates are links, weighted per 90 minutes so teams that played more matches don’t simply look busier.
            Only players with at least 90 minutes appear.
          </p>
          <p>
            For every three-player triangle we add up the passing among its players, then compare it with
            1,000 shuffled versions of the same team in which every player keeps the same number of passing links.
            The z-score says how far above chance a triangle sits; the five highest are the team’s
            <em> signature triangles</em>.
          </p>
          <p>
            Players are placed on their <strong>formation spot</strong> — where they lined up, averaged over the
            minutes they played (a substitute takes the spot of the player they replaced). That is the one position
            available for all three tournaments, so every year is drawn the same way.
          </p>
        </section>
        <section>
          <h3>Where the data comes from</h3>
          <ul className="sources">
            <li><b>{yearOf(overview.tournaments[0].id)}</b> StatsBomb Open Data (event data).</li>
            <li><b>{yearOf(overview.tournaments[1].id)}</b> FIFA’s official post-match reports, cross-checked against StatsBomb Open Data. Where FIFA’s pass table leaves out the goalkeeper (10 team-matches), StatsBomb fills the gap.</li>
            <li><b>{yearOf(overview.tournaments[2].id)}</b> FIFA’s official post-match reports (FIFA Training Centre).</li>
          </ul>
          <p>
            FIFA and StatsBomb count passes slightly differently: on the same 2022 player pairs StatsBomb records about
            {' '}{Math.round((1 / scale - 1) * 100)}% more. Team pass volumes for {yearOf(overview.tournaments[0].id)} are scaled by {scale.toFixed(3)} so the
            three years sit on one scale. Triangles are unaffected by this.
          </p>
          <p>
            Because {yearOf(overview.tournaments[0].id)} comes from a different source, we re-ran{' '}
            {yearOf(overview.tournaments[1].id)} on StatsBomb’s data alone: the trends in the story hold (attacking triangles 13% vs
            22% in {yearOf(overview.tournaments[0].id)}; back-line triangles 34% vs 11%; passes among keeper and defenders 26.5% vs 21%;
            the typical goalkeeper received 14.5 passes per 90 vs 9).
          </p>
          <p>
            <strong>Pass direction</strong> is shown only where passes have recorded locations: all of{' '}
            {yearOf(overview.tournaments[0].id)} and most of {yearOf(overview.tournaments[1].id)}. FIFA’s{' '}
            {yearOf(overview.tournaments[2].id)} reports don’t include locations, so direction is switched off there rather than guessed.
          </p>
        </section>
        <section>
          <h3>Following players across years</h3>
          <p>
            {yearOf(overview.tournaments[0].id)} and {yearOf(overview.tournaments[1].id)} share StatsBomb player IDs. For{' '}
            {yearOf(overview.tournaments[2].id)}, players are linked when their name matches exactly within the same national team; a few
            near-matches (e.g. “Neymar Jr” / “Neymar”) were checked by hand, and look-alikes that are different people
            were left unlinked.
          </p>
          <h3>Limits</h3>
          <p>
            Completed passes only. Players under 90 minutes are left out. Per-90 rates can flatter players who
            mostly featured in lopsided games. Formation spots show where a player lined up, not where he played the ball.
            {doc ? ` Showing ${doc.team.name}, ${yearOf(doc.tournament.id)} — source: ${doc.tournament.source}.` : ''}
          </p>
          <p className="credits">
            A personal data-visualisation project. Data: StatsBomb Open Data; FIFA Training Centre post-match summary reports.
          </p>
        </section>
      </div>
    </details>
  )
}
