import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  SafeAreaView, ScrollView, Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';

import AssetsTab from '@/components/tabs/AssetsTab';
import WalletsTab from '@/components/tabs/WalletsTab';
import ProfileTab from '@/components/tabs/ProfileTab';
import CommunityTab from '@/components/tabs/CommunityTab';
import ExchangesTab from '@/components/tabs/ExchangesTab';
import RecommendationsTab from '@/components/tabs/RecommendationsTab';

// ─── Tab config ──────────────────────────────────────────────────────────────
// Para agregar una nueva tab:
//   1. Importar el componente arriba
//   2. Agregar un objeto a este array
// ─────────────────────────────────────────────────────────────────────────────
type TabConfig = {
  id: string;
  label: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  component: React.ComponentType | null; // null = coming soon
};

const TABS: TabConfig[] = [
  {
    id: 'profile',
    label: 'Perfil',
    icon: 'person',
    component: ProfileTab,
  },
  {
    id: 'assets',
    label: 'Assets',
    icon: 'trending-up',
    component: AssetsTab,
  },
  {
    id: 'wallets',
    label: 'Wallets',
    icon: 'account-balance-wallet',
    component: WalletsTab,
  },
  {
    id: 'exchanges',
    label: 'Exchanges',
    icon: 'swap-horiz',
    component: ExchangesTab,
  },
  {
    id: 'community',
    label: 'Comunidad',
    icon: 'people',
    component: CommunityTab, 
  },
  {
    id: 'recommendations',
    label: 'IA',
    icon: 'auto-awesome',
    component: RecommendationsTab,
  },
];

// ─────────────────────────────────────────────────────────────────────────────

export default function MainScreen() {
  const { tab: tabParam } = useLocalSearchParams<{ tab?: string }>();
  const firstEnabled = TABS.find(t => t.component !== null)?.id ?? TABS[0].id;

  // Arrancamos en la tab que venga por query param (?tab=wallets, etc).
  // Sirve para que pantallas como wallet-detail puedan volver a la tab correcta.
  const initialTab =
    tabParam && TABS.some(t => t.id === tabParam && t.component !== null)
      ? tabParam
      : firstEnabled;

  const [activeTab, setActiveTab] = useState(initialTab);

  // Si cambia el query param después de montar (volver acá con router.replace)
  // sincronizamos la tab.
  useEffect(() => {
    if (tabParam && TABS.some(t => t.id === tabParam && t.component !== null)) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  const current = TABS.find(t => t.id === activeTab);
  const TabContent = current?.component ?? null;

  return (
    <SafeAreaView style={styles.root}>
      {/* Top tab bar */}
      <View style={styles.tabBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabBarInner}
        >
          {TABS.map(tab => {
            const isActive = tab.id === activeTab;
            const isDisabled = tab.component === null;
            return (
              <TouchableOpacity
                key={tab.id}
                style={[styles.tab, isActive && styles.tabActive]}
                onPress={() => !isDisabled && setActiveTab(tab.id)}
                activeOpacity={isDisabled ? 1 : 0.7}
              >
                <MaterialIcons
                  name={tab.icon}
                  size={20}
                  color={isDisabled ? '#2a4a60' : isActive ? '#00ADD8' : '#4a6a80'}
                />
                <Text
                  style={[
                    styles.tabLabel,
                    isActive && styles.tabLabelActive,
                    isDisabled && styles.tabLabelDisabled,
                  ]}
                >
                  {tab.label}
                </Text>
                {isDisabled && (
                  <View style={styles.soonBadge}>
                    <Text style={styles.soonText}>soon</Text>
                  </View>
                )}
                {isActive && <View style={styles.activeIndicator} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Tab content */}
      <View style={styles.content}>
        {TabContent ? (
          <TabContent />
        ) : (
          <View style={styles.comingSoon}>
            <MaterialIcons name={current?.icon ?? 'hourglass-empty'} size={56} color="#1e3a5a" />
            <Text style={styles.comingSoonTitle}>{current?.label}</Text>
            <Text style={styles.comingSoonSub}>Próximamente</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0a1628',
    paddingTop: Platform.OS === 'android' ? 32 : 0,
  },
  tabBar: {
    borderBottomWidth: 1,
    borderBottomColor: '#132238',
  },
  tabBarInner: {
    flexDirection: 'row',
    paddingHorizontal: 12,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 14,
    position: 'relative',
  },
  tabActive: {},
  tabLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4a6a80',
  },
  tabLabelActive: {
    color: '#00ADD8',
  },
  tabLabelDisabled: {
    color: '#2a4a60',
  },
  activeIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 16,
    right: 16,
    height: 2,
    backgroundColor: '#00ADD8',
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
  soonBadge: {
    backgroundColor: '#132238',
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
    marginLeft: 2,
  },
  soonText: {
    color: '#2a4a60',
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  content: {
    flex: 1,
  },
  comingSoon: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  comingSoonTitle: {
    color: '#4a6a80',
    fontSize: 20,
    fontWeight: '700',
  },
  comingSoonSub: {
    color: '#2a4a60',
    fontSize: 14,
  },
});
