import React from 'react';
import {Composition} from 'remotion';
import {BuildingCard} from './BuildingCard';
import {StatCard} from './StatCard';
import {DataTable} from './DataTable';
import {QuoteCard} from './QuoteCard';
import {HeadlineCard} from './HeadlineCard';
import {NewsHeadlineCard} from './NewsHeadlineCard';
import {CompareCard} from './CompareCard';
import {IconRowCard} from './IconRowCard';
import {LogoOrgCard} from './LogoOrgCard';
import {BarChartCard} from './BarChartCard';
import {SpecGridCard} from './SpecGridCard';
import {TripleCompareCard} from './TripleCompareCard';
import {CalendarCompareCard} from './CalendarCompareCard';
import {CleoStatCard} from './CleoStatCard';
import {Floor3DCard} from './Floor3DCard';
import {YHeadlineCard} from './YHeadlineCard';
import {YRankBarsCard} from './YRankBarsCard';
import {YFlowCard} from './YFlowCard';
import {YTableCard} from './YTableCard';
import {GeoMapCard} from './GeoMapCard';
import {SeatDotsCard} from './SeatDotsCard';
import {UnitBlocksCard} from './UnitBlocksCard';
import {TrendCard} from './TrendCard';
import {TimelineBarsCard} from './TimelineBarsCard';
import {SphereHeroCard} from './SphereHeroCard';
import {IconCountCard} from './IconCountCard';
import {FloorStackCard} from './FloorStackCard';
import {FootageCard} from './FootageCard';
import {PaperStatCard} from './PaperStatCard';
import {PaperElevationCard} from './PaperElevationCard';
import {PaperCompareCard, PaperTableCard, PaperTimelineCard, PaperCountCard, PaperArticleCard, FootageAnnotateCard} from './PaperKit';
import {FootageStatCard, PaperWorldMapCard, PaperDocumentCard} from './PaperKit2';
import {FootageLabelCard, SatelliteRouteCard, PaperMassingCard, PaperSectionCard} from './PaperKit3';
import {ArchiveCard, SourceClipCard, ThenNowCard} from './ArchiveKit';
import {PaperWalkCard, PaperBarCard} from './PaperKit4';
import {PaperDotsCard, PaperTrendCard, PaperQuoteCard} from './PaperKit5';
import {PaperFormulaCard, PaperShareCard, PaperOrgCard, PaperListCard, PaperPressCard, PaperPortraitCard, PaperChoroCard} from './PaperKit6';
import {YQuoteCard} from './YQuoteCard';
import {YCompareCard} from './YCompareCard';
import {SkylineCompareCard} from './SkylineCompareCard';
import {TowerGaugeCard} from './TowerGaugeCard';
import {PaperFlowCard} from './PaperFlowCard';
import {PaperFlowCardV4} from './PaperFlowCardV4';
import {PaperImageCard} from './PaperImageCard';
import {NewsQuoteCard} from './NewsQuoteCard';
import {SectionCard} from './SectionCard';
import {RatioCard} from './RatioCard';
import {SightlineCard} from './SightlineCard';
import {RankTrendCard} from './RankTrendCard';
import {ExplodedStackCard} from './ExplodedStackCard';
import {TimelineRailCard} from './TimelineRailCard';
import {AreaNestCard} from './AreaNestCard';
import {DotMatrixCard} from './DotMatrixCard';
import {SectionPhotoCard} from './SectionPhotoCard';
import {ParkCompareCard} from './ParkCompareCard';
import {FullBleedCard} from './FullBleedCard';
import {PhotoStepsCard} from './PhotoStepsCard';
import {ElevatorCard} from './ElevatorCard';
import {SplitCard} from './SplitCard';
import {BigStatsCard} from './BigStatsCard';
import {PhotoSplitCard} from './PhotoSplitCard';
import {ExchangeMotionCard} from './ExchangeMotionCard';
import {MotionSample} from './MotionSample';
import {MotionWrap} from './MotionWrap';
import {AnnotatedShotCard} from './AnnotatedShotCard';
import {ScaleCompareCard} from './ScaleCompareCard';
import {BeforeAfterCard} from './BeforeAfterCard';
import {TrackRecordCard} from './TrackRecordCard';
import {BrandCard} from './BrandCard';
import {StrikeSwapCard} from './StrikeSwapCard';
import {ArticleCard} from './ArticleCard';
import {IsoDiagramCard} from './IsoDiagramCard';
import {MapCard} from './MapCard';
import {SectionDiagramCard} from './SectionDiagramCard';
import {LayerPeelCard} from './LayerPeelCard';
import {MassingCard} from './MassingCard';
import {NodeArrayCard} from './NodeArrayCard';
import {SplitProofCard} from './SplitProofCard';
import {FrontageCard} from './FrontageCard';
import {ShareSplitCard} from './ShareSplitCard';
import {YardViewCard} from './YardViewCard';
import {SitePlotCard} from './SitePlotCard';
import {ShapeCompareCard} from './ShapeCompareCard';
import {LowerThirdCard} from './LowerThirdCard';

import {StarWarpCard} from './StarWarpCard';
import {setMotionMode} from './anim';

const FPS = 30;

// 모션 예산 — 장면 props 의 motion('still'|'accent'|'full')을 렌더 직전에 심는다.
// 컴포넌트 정체성이 매 프레임 바뀌면 리마운트되므로 한 번 만든 래퍼를 캐시한다.
const wrapped = new Map();
const withMotion = (Comp) => {
  if (!wrapped.has(Comp)) {
    const W = (props) => {
      setMotionMode(props.motion);
      return <Comp {...props} />;
    };
    wrapped.set(Comp, W);
  }
  return wrapped.get(Comp);
};
const durationFromProps = ({props}) => ({
  durationInFrames: Math.round((props.durationSec ?? 10) * FPS),
});

export const RemotionRoot = () => {
  return (
    <>
      <Composition
        id="BuildingCard"
        component={BuildingCard}
        fps={FPS}
        width={1920}
        height={1080}
        durationInFrames={300}
        defaultProps={{
          title: '소셜아파트 한 동당 객실 수',
          valuePrefix: '30 ~ ',
          valueTarget: 150,
          valueSuffix: '실',
          floors: 8,
          accent: '#A9C6FF',
        }}
        calculateMetadata={async ({props}) => durationFromProps({props})}
      />
      <Composition
        id="StatCard"
        component={StatCard}
        fps={FPS}
        width={1920}
        height={1080}
        durationInFrames={300}
        defaultProps={{
          title: '',
          value: '',
          subtitle: '',
          caption: '',
        }}
        calculateMetadata={async ({props}) => durationFromProps({props})}
      />
      <Composition
        id="DataTable"
        component={DataTable}
        fps={FPS}
        width={1920}
        height={1080}
        durationInFrames={300}
        defaultProps={{
          title: '',
          rows: [],
          source: '',
        }}
        calculateMetadata={async ({props}) => durationFromProps({props})}
      />
      <Composition
        id="QuoteCard"
        component={QuoteCard}
        fps={FPS}
        width={1920}
        height={1080}
        durationInFrames={300}
        defaultProps={{
          quote: '',
          name: '',
          role: '',
        }}
        calculateMetadata={async ({props}) => durationFromProps({props})}
      />
      <Composition
        id="HeadlineCard"
        component={HeadlineCard}
        fps={FPS}
        width={1920}
        height={1080}
        durationInFrames={300}
        defaultProps={{
          line1: '',
          line2: '',
        }}
        calculateMetadata={async ({props}) => durationFromProps({props})}
      />
      <Composition
        id="NewsHeadlineCard"
        component={NewsHeadlineCard}
        fps={FPS}
        width={1920}
        height={1080}
        durationInFrames={300}
        defaultProps={{
          outlet: '', date: '', headline: '',
          outlet2: '', date2: '', headline2: '',
        }}
        calculateMetadata={async ({props}) => durationFromProps({props})}
      />
      <Composition
        id="CompareCard"
        component={CompareCard}
        fps={FPS}
        width={1920}
        height={1080}
        durationInFrames={300}
        defaultProps={{
          title: '', leftTitle: '', leftLines: [],
          rightTitle: '', rightLines: [], rightEmpty: false, emptyLabel: '확인되지 않음',
          leftValue: '', rightValue: '', caption: '',
        }}
        calculateMetadata={async ({props}) => durationFromProps({props})}
      />
      <Composition
        id="IconRowCard"
        component={IconRowCard}
        fps={FPS}
        width={1920}
        height={1080}
        durationInFrames={300}
        defaultProps={{title: '', subtitle: '', items: []}}
        calculateMetadata={async ({props}) => durationFromProps({props})}
      />
      <Composition
        id="LogoOrgCard"
        component={LogoOrgCard}
        fps={FPS}
        width={1920}
        height={1080}
        durationInFrames={300}
        defaultProps={{title: '', subtitle: '', parentLogo: '', parentLabel: '', children: []}}
        calculateMetadata={async ({props}) => durationFromProps({props})}
      />
      <Composition
        id="BarChartCard"
        component={BarChartCard}
        fps={FPS}
        width={1920}
        height={1080}
        durationInFrames={300}
        defaultProps={{title: '', bars: [], source: '', closingLine: ''}}
        calculateMetadata={async ({props}) => durationFromProps({props})}
      />
      <Composition
        id="SpecGridCard"
        component={SpecGridCard}
        fps={FPS}
        width={1920}
        height={1080}
        durationInFrames={300}
        defaultProps={{title: '', items: [], source: ''}}
        calculateMetadata={async ({props}) => durationFromProps({props})}
      />
      <Composition
        id="TripleCompareCard"
        component={TripleCompareCard}
        fps={FPS}
        width={1920}
        height={1080}
        durationInFrames={300}
        defaultProps={{title: '', items: [], source: ''}}
        calculateMetadata={async ({props}) => durationFromProps({props})}
      />
      <Composition
        id="CalendarCompareCard"
        component={CalendarCompareCard}
        fps={FPS}
        width={1920}
        height={1080}
        durationInFrames={300}
        defaultProps={{title: '', closingLine: ''}}
        calculateMetadata={async ({props}) => durationFromProps({props})}
      />
      {[
        ['GeoMapCard', GeoMapCard, {markers: []}],
        ['SeatDotsCard', SeatDotsCard, {arenas: []}],
        ['UnitBlocksCard', UnitBlocksCard, {groups: []}],
        ['TrendCard', TrendCard, {series: []}],
        ['TimelineBarsCard', TimelineBarsCard, {bars: []}],
        ['SphereHeroCard', SphereHeroCard, {annotations: []}],
        ['IconCountCard', IconCountCard, {count: 6}],
        ['FloorStackCard', FloorStackCard, {floors: []}],
        ['FootageCard', FootageCard, {}],
        ['PaperStatCard', PaperStatCard, {}],
        ['PaperElevationCard', PaperElevationCard, {floors: []}],
        ['PaperFlowCardV4', PaperFlowCardV4, {nodes: [], arrows: []}],
        ['PaperCompareCard', PaperCompareCard, {left: {}, right: {}}],
        ['PaperTableCard', PaperTableCard, {rows: []}],
        ['PaperTimelineCard', PaperTimelineCard, {steps: []}],
        ['PaperCountCard', PaperCountCard, {count: 6}],
        ['PaperArticleCard', PaperArticleCard, {}],
        ['FootageAnnotateCard', FootageAnnotateCard, {}],
        ['FootageStatCard', FootageStatCard, {}],
        ['PaperWorldMapCard', PaperWorldMapCard, {markers: []}],
        ['PaperDocumentCard', PaperDocumentCard, {docBody: []}],
        ['FootageLabelCard', FootageLabelCard, {labels: []}],
        ['SatelliteRouteCard', SatelliteRouteCard, {regions: []}],
        ['PaperMassingCard', PaperMassingCard, {}],
        ['PaperSectionCard', PaperSectionCard, {above: [], below: []}],
        ['ArchiveCard', ArchiveCard, {}],
        ['SourceClipCard', SourceClipCard, {}],
        ['ThenNowCard', ThenNowCard, {}],
        ['PaperWalkCard', PaperWalkCard, {}],
        ['PaperBarCard', PaperBarCard, {bars: []}],
        ['PaperDotsCard', PaperDotsCard, {}],
        ['PaperTrendCard', PaperTrendCard, {series: []}],
        ['PaperQuoteCard', PaperQuoteCard, {}],
        ['PaperFormulaCard', PaperFormulaCard, {terms: [], ops: []}],
        ['PaperShareCard', PaperShareCard, {parts: []}],
        ['PaperOrgCard', PaperOrgCard, {children: []}],
        ['PaperListCard', PaperListCard, {items: []}],
        ['PaperPressCard', PaperPressCard, {columns: []}],
        ['PaperPortraitCard', PaperPortraitCard, {}],
        ['PaperChoroCard', PaperChoroCard, {regions: []}],
      ].map(([id, comp, defaults]) => (
        <Composition
          key={id}
          id={id}
          component={withMotion(comp)}
          fps={FPS}
          width={1920}
          height={1080}
          durationInFrames={300}
          defaultProps={defaults}
          calculateMetadata={async ({props}) => durationFromProps({props})}
        />
      ))}
      <Composition
        id="YTableCard"
        component={YTableCard}
        fps={FPS}
        width={1920}
        height={1080}
        durationInFrames={300}
        defaultProps={{rows: []}}
        calculateMetadata={async ({props}) => durationFromProps({props})}
      />
      <Composition
        id="YQuoteCard"
        component={YQuoteCard}
        fps={FPS}
        width={1920}
        height={1080}
        durationInFrames={300}
        defaultProps={{quote: ''}}
        calculateMetadata={async ({props}) => durationFromProps({props})}
      />
      <Composition
        id="YCompareCard"
        component={YCompareCard}
        fps={FPS}
        width={1920}
        height={1080}
        durationInFrames={300}
        defaultProps={{left: {}, right: {}}}
        calculateMetadata={async ({props}) => durationFromProps({props})}
      />
      <Composition
        id="YHeadlineCard"
        component={YHeadlineCard}
        fps={FPS}
        width={1920}
        height={1080}
        durationInFrames={300}
        defaultProps={{lines: []}}
        calculateMetadata={async ({props}) => durationFromProps({props})}
      />
      <Composition
        id="YRankBarsCard"
        component={YRankBarsCard}
        fps={FPS}
        width={1920}
        height={1080}
        durationInFrames={300}
        defaultProps={{rows: []}}
        calculateMetadata={async ({props}) => durationFromProps({props})}
      />
      <Composition
        id="YFlowCard"
        component={YFlowCard}
        fps={FPS}
        width={1920}
        height={1080}
        durationInFrames={300}
        defaultProps={{nodes: [], arrows: []}}
        calculateMetadata={async ({props}) => durationFromProps({props})}
      />
      <Composition
        id="Floor3DCard"
        component={Floor3DCard}
        fps={FPS}
        width={1920}
        height={1080}
        durationInFrames={300}
        defaultProps={{}}
        calculateMetadata={async ({props}) => durationFromProps({props})}
      />
      <Composition
        id="CleoStatCard"
        component={CleoStatCard}
        fps={FPS}
        width={1920}
        height={1080}
        durationInFrames={300}
        defaultProps={{}}
        calculateMetadata={async ({props}) => durationFromProps({props})}
      />
      <Composition
        id="SkylineCompareCard"
        component={SkylineCompareCard}
        fps={FPS}
        width={1920}
        height={1080}
        durationInFrames={300}
        defaultProps={{buildings: []}}
        calculateMetadata={async ({props}) => durationFromProps({props})}
      />
      <Composition
        id="TowerGaugeCard"
        component={TowerGaugeCard}
        fps={FPS}
        width={1920}
        height={1080}
        durationInFrames={300}
        defaultProps={{items: []}}
        calculateMetadata={async ({props}) => durationFromProps({props})}
      />
      <Composition
        id="PaperFlowCard"
        component={PaperFlowCard}
        fps={FPS}
        width={1920}
        height={1080}
        durationInFrames={300}
        defaultProps={{nodes: []}}
        calculateMetadata={async ({props}) => durationFromProps({props})}
      />
      <Composition
        id="PaperImageCard"
        component={PaperImageCard}
        fps={FPS}
        width={1920}
        height={1080}
        durationInFrames={300}
        defaultProps={{}}
        calculateMetadata={async ({props}) => durationFromProps({props})}
      />
      {[
        ['SectionCard', SectionCard, {bands: []}],
        ['RatioCard', RatioCard, {items: []}],
        ['SightlineCard', SightlineCard, {}],
        ['RankTrendCard', RankTrendCard, {points: []}],
        ['ExplodedStackCard', ExplodedStackCard, {layers: []}],
        ['TimelineRailCard', TimelineRailCard, {rails: []}],
        ['AreaNestCard', AreaNestCard, {items: []}],
        ['DotMatrixCard', DotMatrixCard, {groups: []}],
        ['SectionPhotoCard', SectionPhotoCard, {bands: []}],
        ['ParkCompareCard', ParkCompareCard, {sides: []}],
        ['FullBleedCard', FullBleedCard, {}],
        ['PhotoStepsCard', PhotoStepsCard, {steps: []}],
        ['ElevatorCard', ElevatorCard, {stops: []}],
        ['SplitCard', SplitCard, {left: {}, right: {}}],
        ['BigStatsCard', BigStatsCard, {items: []}],
        ['PhotoSplitCard', PhotoSplitCard, {sides: []}],
        ['ExchangeMotionCard', ExchangeMotionCard, {left: {}, right: {}}],
        ['AnnotatedShotCard', AnnotatedShotCard, {beats: []}],
        ['ScaleCompareCard', ScaleCompareCard, {items: []}],
        ['BeforeAfterCard', BeforeAfterCard, {}],
        ['TrackRecordCard', TrackRecordCard, {items: []}],
        ['BrandCard', BrandCard, {}],
        ['StrikeSwapCard', StrikeSwapCard, {}],
        ['ArticleCard', ArticleCard, {}],
        ['IsoDiagramCard', IsoDiagramCard, {blocks: []}],
        ['MapCard', MapCard, {pins: []}],
        ['SectionDiagramCard', SectionDiagramCard, {ground: [], cut: []}],
        ['LayerPeelCard', LayerPeelCard, {layers: []}],
        ['MassingCard', MassingCard, {}],
        ['NodeArrayCard', NodeArrayCard, {hits: []}],
        ['SplitProofCard', SplitProofCard, {layers: []}],
        ['FrontageCard', FrontageCard, {options: []}],
        ['ShareSplitCard', ShareSplitCard, {}],
        ['YardViewCard', YardViewCard, {}],
        ['SitePlotCard', SitePlotCard, {}],
        ['ShapeCompareCard', ShapeCompareCard, {items: []}],
        ['LowerThirdCard', LowerThirdCard, {}],
      ].map(([id, comp, defaults]) => (
        <Composition
          key={id}
          id={id}
          component={comp}
          fps={FPS}
          width={1920}
          height={1080}
          durationInFrames={300}
          defaultProps={defaults}
          calculateMetadata={async ({props}) => durationFromProps({props})}
        />
      ))}
      <Composition
        id="StarWarp"
        component={StarWarpCard}
        fps={30}
        width={1920}
        height={1080}
        durationInFrames={90}
        defaultProps={{}}
      />
      <Composition
        id="MotionWrap"
        component={MotionWrap}
        fps={FPS}
        width={1920}
        height={1080}
        durationInFrames={300}
        defaultProps={{card: '', props: {}, motion: {}}}
        calculateMetadata={async ({props}) => durationFromProps({props})}
      />
      <Composition
        id="MotionSample"
        component={MotionSample}
        fps={FPS}
        width={1920}
        height={1080}
        durationInFrames={24 * FPS}
        defaultProps={{}}
      />
      <Composition
        id="NewsQuoteCard"
        component={NewsQuoteCard}
        fps={FPS}
        width={1920}
        height={1080}
        durationInFrames={300}
        defaultProps={{headline: []}}
        calculateMetadata={async ({props}) => durationFromProps({props})}
      />
    </>
  );
};
