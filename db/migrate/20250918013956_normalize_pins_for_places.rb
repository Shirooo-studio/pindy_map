class NormalizePinsForPlaces < ActiveRecord::Migration[7.2]
  def up
    # 1) place_id -> google_place_id
    if column_exists?(:pins, :place_id) && !column_exists?(:pins, :google_place_id)
      rename_column :pins, :place_id, :google_place_id
    end

    # 2) lat/lng を decimal(10,6) へ（精度を安定化）
    if column_exists?(:pins, :latitude)
      change_column :pins, :latitude, :decimal, precision: 10, scale: 6, using: "latitude::decimal"
    end
    if column_exists?(:pins, :longitude)
      change_column :pins, :longitude, :decimal, precision: 10, scale: 6, using: "longitude::decimal"
    end

    #3) visibility のデフォルトと NOT NULL を確定（NULL は 1 に埋める）
    execute "UPDATE pins SET visibility = 1 WHERE visibility IS NULL"
    change_column_default :pins, :visibility, from: nil, to: 1
    change_column_null :pins, :visibility, false

    #4) インデックス（重複防止：user_id x google_place_id）
    unless index_exists?(:pins, [:user_id, :google_place_id], name: "idx_pins_user_place_unique")
      add_index :pins, [:user_id, :google_place_id],
        unique: true,
        where: "google_place_id IS NOT NULL",
        name: "idx_pins_user_place_unique"
    end

    # 参考：検索最適化用の補助インデックス（任意）
    add_index :pins, :google_place_id unless index_exists?(:pins, :google_place_id)
    add_index :pins, [:latitude, :longitude] unless index_exists?(:pins, [:latitude, :longitude])
  end

  def down
    # 補助インデックス削除
    remove_index :pins, name: "idx_pins_user_place_unique" if index_exists?(:pins, name: "idx_pins_user_place_unique")
    remove_index :pins, column: :google_place_id if index_exists?(:pins, :google_place_id)
    remove_index :pins, column: [:latitude, :longitude] if index_exists?(:pins, [:latitude, :longitude])

    # visibility 制約を元に戻す
    change_column_null :pins, :visibility, true
    change_column_default :pins, :visibility, from: 1, to: nil

    # 型を float に戻す
    change_column :pins, :latitude, :float if column_exists?(:pins, :latitude)
    change_column :pins, :longitude, :float if column_exists?(:pins, :longitude)

    # カラム名を戻す
    if column_exists?(:pins, :google_place_id) && !column_exists?(:pins, :place_id)
      rename_column :pins, :google_place_id, :place_id
    end
  end
end
