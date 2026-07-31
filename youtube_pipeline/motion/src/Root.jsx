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
import {YQuoteCard} from './YQuoteCard';
import {YCompareCard} from './YCompareCard';

const FPS = 30;
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
    </>
  );
};
