class MesController < ApplicationController
  before_action :authenticate_user!

  def pins
    pins = current_user.pins
      .select(:id, :name, :address, :google_place_id, :latitude, :longitude, :created_at)
      .order(created_at: :desc)

    render json: pins.as_json
  end

  def posts
    posts = current_user.posts
      .includes(media_attachments: :blob) # ActiveStorage 付きなら
      .select(:id, :title, :body, :created_at)
      .order(created_at: :desc)

    render json: posts.map { |p|
      {
        id:    p.id,
        title: p.title,
        body:  p.body,
        created_at: p.created_at,
        # 画像/動画を1〜数件返したい場合（あなたのJSは配列を想定済み）
        media: Array(p.try(:media)).first(3).to_a.map { |m|
          ct = m.content_type.to_s
          {
            type:   ct.start_with?("video/") ? "video" : "image",
            url:    url_for(m),
            poster: ct.start_with?("video/") ? m.preview(resize_to_limit: [640, 360]).processed.url : nil
          }
        }
      }
    }
  end
end