import React from 'react';
import {Composition} from 'remotion';
import {BuildingCard} from './BuildingCard';
import {StatCard} from './StatCard';
import {DataTable} from './DataTable';
import {QuoteCard} from './QuoteCard';
import {HeadlineCard} from './HeadlineCard';

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
    </>
  );
};
